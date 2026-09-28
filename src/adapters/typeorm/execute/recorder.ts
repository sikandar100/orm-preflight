import type { ExtractedStep, Loc } from '../../../ir/types.js'
import type { Dialect } from '../../../rules/types.js'
import { mapBuilderCall, READ_METHODS, TRANSACTION_METHODS } from '../builder.js'
import type { Value } from '../extract/values.js'

/** What a read returns during --execute: nothing, as if the database were empty. */
const READ_RESULTS: Readonly<Record<string, unknown>> = {
  getTables: [],
  getViews: [],
  getDatabases: [],
  getSchemas: [],
}

const MAX_DEPTH = 32

export interface Recorder {
  /** Passed to up() in place of TypeORM's QueryRunner. */
  queryRunner: object
  steps: ExtractedStep[]
}

/**
 * A stand-in for TypeORM's QueryRunner that records what up() does instead of touching a
 * database. `file` is the path used in findings, `absolutePath` the file on disk, used to
 * find the calling line in stack traces, and `fallback` the location used when no line in
 * the migration file is on the stack (for example, a call from an imported helper).
 */
export function createRecorder(options: {
  file: string
  absolutePath: string
  dialect: Dialect
  inTransaction: boolean
  fallback: Loc
}): Recorder {
  const { file, absolutePath, dialect, fallback } = options
  const steps: ExtractedStep[] = []
  let inTransaction = options.inTransaction

  const here = (): Loc => callSite(new Error().stack ?? '', absolutePath, file) ?? fallback
  const unanalyzable = (reason: string, loc = here()) => {
    steps.push({
      kind: 'operation',
      operation: { kind: 'unanalyzable', reason, loc, origin: 'execute' },
    })
  }

  const query = (sql: unknown): Promise<unknown[]> => {
    const loc = here()
    if (typeof sql === 'string') {
      steps.push({
        kind: 'sql',
        sql,
        loc,
        map: { file, runs: [{ offset: 0, line: loc.line, column: loc.column }] },
      })
    } else {
      unanalyzable('query() was called with something other than a SQL string', loc)
    }
    return Promise.resolve([])
  }

  const driverType = dialect === 'mysql' ? 'mysql' : 'postgres'
  const connection = { options: { type: driverType }, driver: { options: { type: driverType } } }

  const target: Record<string, unknown> = {
    query,
    manager: { query },
    connection,
    dataSource: connection,
  }

  const queryRunner = new Proxy(target, {
    get(obj, name) {
      if (typeof name === 'symbol' || name === 'then') return undefined
      if (name === 'isTransactionActive') return inTransaction
      if (name in obj) return obj[name]
      const action = TRANSACTION_METHODS[name]
      if (action !== undefined) {
        return () => {
          inTransaction = action === 'start'
          steps.push({
            kind: 'operation',
            operation: { kind: 'transaction_control', action, loc: here(), origin: 'execute' },
          })
          return Promise.resolve()
        }
      }
      if (READ_METHODS.has(name)) {
        return () => {
          if (!name.includes('SqlMemory')) {
            unanalyzable(
              `up() reads the database with ${name}(). orm-preflight answers as if it were empty, so a real database may lead to different statements`,
            )
          }
          return Promise.resolve(
            name in READ_RESULTS ? READ_RESULTS[name] : name.startsWith('has') ? false : undefined,
          )
        }
      }
      return (...args: unknown[]) => {
        const loc = here()
        const result = mapBuilderCall(
          name,
          args.map((a) => toValue(a, 0)),
          dialect,
        )
        if (result.ok) {
          for (const op of result.ops)
            steps.push({ kind: 'operation', operation: { ...op, loc, origin: 'execute' } })
        } else {
          unanalyzable(result.reason, loc)
        }
        return Promise.resolve(undefined)
      }
    },
  })

  return { queryRunner, steps }
}

/** Converts a value up() passed at run time into the shape the builder mapping reads. */
export function toValue(value: unknown, depth: number): Value {
  if (depth > MAX_DEPTH) return { kind: 'unknown', reason: 'The value is nested too deeply' }
  switch (typeof value) {
    case 'string':
      return { kind: 'string', value }
    case 'number':
      return { kind: 'number', value }
    case 'boolean':
      return { kind: 'boolean', value }
    case 'undefined':
      return { kind: 'undefined' }
    case 'object': {
      if (value === null) return { kind: 'null' }
      if (Array.isArray(value))
        return { kind: 'array', items: value.map((v) => toValue(v, depth + 1)) }
      const ctor = (value as { constructor?: { name?: unknown } }).constructor?.name
      const props = new Map<string, Value>()
      for (const [key, v] of Object.entries(value)) props.set(key, toValue(v, depth + 1))
      return {
        kind: 'object',
        ...(typeof ctor === 'string' && ctor !== 'Object' ? { ctor } : {}),
        props,
        partial: false,
      }
    }
    default:
      return { kind: 'unknown', reason: `The value is a ${typeof value}` }
  }
}

/**
 * The first stack frame inside the migration file, as a location in it. Stack frames look
 * like `at X (/path/file.ts:12:5)` or `at /path/file.ts:12:5`, sometimes with a file:// URL.
 */
export function callSite(stack: string, absolutePath: string, file: string): Loc | undefined {
  for (const line of stack.split('\n')) {
    const at = line.lastIndexOf(absolutePath)
    if (at === -1) continue
    const match = /^:(\d+):(\d+)/.exec(line.slice(at + absolutePath.length))
    if (match?.[1] !== undefined && match[2] !== undefined) {
      return { file, line: Number(match[1]), column: Number(match[2]) }
    }
  }
  return undefined
}
