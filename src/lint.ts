import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { OrmAdapter, SourceFile } from './adapter-api.js'
import { type ConfigOverrides, loadConfig, type ResolvedConfig } from './config/load.js'
import { type ChangeSet, changesSince } from './discovery/git.js'
import { discoverFiles } from './discovery/index.js'
import type { ExtractedMigration } from './ir/types.js'
import { runRules } from './engine/run.js'
import { UsageError } from './errors.js'
import { coreRules } from './rules/index.js'
import type { Finding } from './rules/types.js'
import { parseMigrations } from './sql/index.js'
import { version } from './version.js'

export interface LintOptions {
  /** Project root. Defaults to the current directory. */
  cwd?: string
  /** Files or globs to lint. Defaults to the config's "migrations", then the ORM's default. */
  patterns?: string[]
  /** Path of a config file, instead of discovering one. */
  configPath?: string
  overrides?: ConfigOverrides
  /**
   * A git ref. Only migrations added or modified since the merge base with it are linted,
   * and tables created by any of them count as new.
   */
  changedSince?: string
  /**
   * Runs each migration's up() with a recording QueryRunner, to see SQL that is only known at
   * run time. This runs the project's code: only use it on code you trust.
   */
  execute?: boolean
  /** Allows `execute` under GitHub's pull_request_target event, which is refused by default. */
  allowUntrustedExecute?: boolean
  /** Environment variables. Defaults to process.env. */
  env?: Readonly<Record<string, string | undefined>>
  /** Called once `execute` passed its checks, right before any migration code runs. */
  onExecute?: () => void
}

export interface LintSummary {
  errors: number
  warnings: number
  suppressed: number
  files: number
  migrations: number
}

export interface LintResult {
  version: string
  findings: Finding[]
  summary: LintSummary
}

/** How the core finds adapters. Supplied by the public entry point, so the core never imports one. */
export interface AdapterLookup {
  get(id: string): OrmAdapter | undefined
}

/** Loads the config, finds migration files, and lints them. */
export async function runLint(options: LintOptions, adapters: AdapterLookup): Promise<LintResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const config = loadConfig(cwd, options.configPath, options.overrides)
  const adapter = adapters.get(config.orm)
  if (adapter === undefined) throw new UsageError(`Unknown ORM "${config.orm}".`)
  if (options.execute === true) checkExecuteAllowed(adapter, options)

  const explicit = options.patterns !== undefined && options.patterns.length > 0
  const patterns = explicit
    ? options.patterns
    : (config.migrations ?? adapter.defaultMigrationGlobs)
  const matched = await discoverFiles(cwd, patterns ?? [])
  if (matched.length === 0) {
    throw new UsageError(`No migration files matched: ${(patterns ?? []).join(', ')}`)
  }
  const changes =
    options.changedSince === undefined ? undefined : await changesSince(cwd, options.changedSince)
  // With --changed-since, unchanged migrations are history: nothing to lint, not an error.
  const files = changes === undefined ? matched : matched.filter((f) => changes.files.has(f))
  const sources = await Promise.all(
    files.map(async (file) => ({ path: file, text: await readFile(path.join(cwd, file), 'utf8') })),
  )
  if (options.execute === true && sources.length > 0) options.onExecute?.()
  return lintSources(
    sources,
    config,
    adapter,
    changes,
    options.execute === true ? { cwd } : undefined,
  )
}

/**
 * --execute runs project code. Under pull_request_target, GitHub runs a workflow with the
 * base repository's secrets and a write token for pull requests from forks, so running the
 * fork's code there is refused unless the caller insists.
 */
function checkExecuteAllowed(adapter: OrmAdapter, options: LintOptions): void {
  if (adapter.extractDynamic === undefined) {
    throw new UsageError(`--execute is not available for the ${adapter.id} adapter.`)
  }
  const env = options.env ?? process.env
  if (env.GITHUB_EVENT_NAME === 'pull_request_target' && options.allowUntrustedExecute !== true) {
    throw new UsageError(
      '--execute refuses to run under pull_request_target: a pull request from a fork would run its own code with your secrets. Use the pull_request trigger, or pass --allow-untrusted-execute if you are sure.',
    )
  }
}

/**
 * Lints files already in memory. Used by runLint and by tests. With `execute`, migrations
 * are run (see LintOptions.execute), and file paths resolve against `execute.cwd`.
 */
export async function lintSources(
  sources: readonly SourceFile[],
  config: ResolvedConfig,
  adapter: OrmAdapter,
  changes?: ChangeSet,
  execute?: { cwd: string },
): Promise<LintResult> {
  const ctx = { dialect: config.dialect, options: config.adapterOptions }
  const all: ExtractedMigration[] = []
  for (const source of sources) {
    if (execute !== undefined && adapter.extractDynamic !== undefined) {
      // One file at a time: running migrations touches process-wide state, such as console.
      all.push(
        ...(await adapter.extractDynamic(source, path.resolve(execute.cwd, source.path), ctx)),
      )
    } else {
      all.push(...adapter.extract(source, ctx))
    }
  }
  const extracted = all
    // Migrations at or before startAfter are part of the history the project adopted.
    .filter(
      (m) =>
        config.startAfter === undefined || m.timestamp === null || m.timestamp > config.startAfter,
    )
  const migrations = await parseMigrations(extracted, {
    dialect: config.dialect,
    ...(config.defaultSchema === undefined ? {} : { defaultSchema: config.defaultSchema }),
  })
  const findings = runRules(migrations, [...coreRules, ...adapter.rules], {
    dialect: config.dialect,
    pgVersion: config.postgresVersion,
    severities: config.rules,
    adapterOptions: config.adapterOptions,
    defaultSchema: config.defaultSchema,
    changes,
  })
  const active = findings.filter((f) => f.suppressed === null)
  return {
    version,
    findings,
    summary: {
      errors: active.filter((f) => f.severity === 'error').length,
      warnings: active.filter((f) => f.severity === 'warn').length,
      suppressed: findings.length - active.length,
      files: sources.length,
      migrations: migrations.length,
    },
  }
}
