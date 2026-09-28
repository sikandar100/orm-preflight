import { fileURLToPath } from 'node:url'
import type { AdapterContext, SourceFile } from '../../../adapter-api.js'
import type { ExtractedMigration, ExtractedStep, Loc } from '../../../ir/types.js'
import { createRecorder } from './recorder.js'

/** How long up() may run before orm-preflight gives up on it. */
export const DEFAULT_TIMEOUT_MS = 10_000

/** The stand-in for the `typeorm` package, next to this module in src and in dist. */
const TYPEORM_SHIM = fileURLToPath(new URL('./typeorm-shim.cjs', import.meta.url))

/**
 * --execute: loads the migration file and runs each migration's up() with a recording
 * QueryRunner, which catches SQL that is only known at run time. The static extraction of
 * the same file (`statics`) still provides everything else: where each class is, its
 * suppression comments, and its transaction setting.
 *
 * This runs the project's code. It is only for code you trust.
 */
export async function runMigrations(
  file: SourceFile,
  absolutePath: string,
  ctx: AdapterContext,
  statics: ExtractedMigration[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ExtractedMigration[]> {
  if (statics.length === 0) return []
  const { createJiti } = await import('jiti')
  const jiti = createJiti(absolutePath, {
    alias: { typeorm: TYPEORM_SHIM },
    // Never write a cache into the project, and always load the current file.
    fsCache: false,
    moduleCache: false,
    sourceMaps: true,
  })

  const quiet = silenceConsole()
  try {
    let loaded: unknown
    try {
      loaded = await jiti.import(absolutePath)
    } catch (error) {
      return statics.map((m) => withReason(m, `Running the file failed: ${describe(error)}`))
    }
    const results: ExtractedMigration[] = []
    for (const migration of statics) {
      results.push(await run(migration, loaded, file, absolutePath, ctx, timeoutMs))
    }
    return results
  } finally {
    quiet.restore()
  }
}

async function run(
  migration: ExtractedMigration,
  loaded: unknown,
  file: SourceFile,
  absolutePath: string,
  ctx: AdapterContext,
  timeoutMs: number,
): Promise<ExtractedMigration> {
  const className = migration.adapterData?.className
  const Class = typeof className === 'string' ? findClass(loaded, className) : undefined
  if (Class === undefined) {
    return withReason(migration, 'The migration class could not be found in the loaded file')
  }

  const recorder = createRecorder({
    file: file.path,
    absolutePath,
    dialect: ctx.dialect,
    inTransaction: migration.runsInTransaction === true,
    fallback: migration.loc,
  })
  try {
    const instance = new Class() as { up?: (queryRunner: object) => unknown }
    if (typeof instance.up !== 'function') throw new Error('it has no up() method')
    await withTimeout(Promise.resolve(instance.up(recorder.queryRunner)), timeoutMs)
  } catch (error) {
    recorder.steps.push(
      unanalyzableStep(`up() failed while running: ${describe(error)}`, migration.loc),
    )
  }

  return { ...migration, up: withSuppressions(recorder.steps, migration.up) }
}

/** The exported class with this name: a named export, the default export, or module.exports. */
function findClass(loaded: unknown, name: string): (new () => unknown) | undefined {
  const candidates: unknown[] = [loaded]
  if (loaded !== null && typeof loaded === 'object') {
    candidates.push(...Object.values(loaded as Record<string, unknown>))
  }
  for (const candidate of candidates) {
    if (typeof candidate === 'function' && candidate.name === name) {
      return candidate as new () => unknown
    }
  }
  return undefined
}

/**
 * Suppression comments apply to the next statement in the source. The static extraction
 * already worked out which statement that is, so a recorded step on the same line gets the
 * same suppressions.
 */
function withSuppressions(steps: ExtractedStep[], statics: ExtractedStep[]): ExtractedStep[] {
  const byLine = new Map<number, number[]>()
  for (const step of statics) {
    const loc = step.kind === 'sql' ? step.loc : step.operation.loc
    const suppressions = step.kind === 'sql' ? step.suppressions : step.operation.suppressions
    if (suppressions !== undefined && suppressions.length > 0) byLine.set(loc.line, suppressions)
  }
  return steps.map((step) => {
    const loc = step.kind === 'sql' ? step.loc : step.operation.loc
    const suppressions = byLine.get(loc.line)
    if (suppressions === undefined) return step
    return step.kind === 'sql'
      ? { ...step, suppressions }
      : { ...step, operation: { ...step.operation, suppressions } }
  })
}

function withReason(migration: ExtractedMigration, reason: string): ExtractedMigration {
  return { ...migration, up: [unanalyzableStep(reason, migration.loc)] }
}

function unanalyzableStep(reason: string, loc: Loc): ExtractedStep {
  return { kind: 'operation', operation: { kind: 'unanalyzable', reason, loc, origin: 'execute' } }
}

function withTimeout(work: Promise<unknown>, timeoutMs: number): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`it did not finish within ${String(timeoutMs / 1000)} seconds`))
    }, timeoutMs)
  })
  return Promise.race([work, timeout]).finally(() => {
    clearTimeout(timer)
  })
}

function describe(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return (text.split('\n')[0] ?? text).replace(/\.$/, '')
}

/** Keeps a migration's own logging out of orm-preflight's output, such as --format json. */
function silenceConsole(): { restore: () => void } {
  const methods = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const
  // Each method goes back onto the same console object, so its `this` never changes.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const saved = methods.map((m) => [m, globalThis.console[m]] as const)
  for (const m of methods) globalThis.console[m] = () => undefined
  return {
    restore: () => {
      for (const [m, fn] of saved) globalThis.console[m] = fn
    },
  }
}
