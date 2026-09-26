import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { OrmAdapter, SourceFile } from './adapter-api.js'
import { type ConfigOverrides, loadConfig, type ResolvedConfig } from './config/load.js'
import { type ChangeSet, changesSince } from './discovery/git.js'
import { discoverFiles } from './discovery/index.js'
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
  return lintSources(sources, config, adapter, changes)
}

/** Lints files already in memory. Used by runLint and by tests. */
export async function lintSources(
  sources: readonly SourceFile[],
  config: ResolvedConfig,
  adapter: OrmAdapter,
  changes?: ChangeSet,
): Promise<LintResult> {
  const ctx = { dialect: config.dialect, options: config.adapterOptions }
  const extracted = sources
    .flatMap((source) => adapter.extract(source, ctx))
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
