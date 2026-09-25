import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { adapters, getAdapter } from '../adapters/index.js'
import { CONFIG_FILE, type ConfigOverrides, PACKAGE_KEY, resolveConfig } from '../config/load.js'
import { closest } from '../config/validate.js'
import { discoverFiles } from '../discovery/index.js'
import { UsageError } from '../errors.js'
import { coreRules } from '../rules/index.js'
import type { Rule } from '../rules/types.js'
import { ruleDocs } from './rule-docs.js'

const DATABASES = { postgres: 'PostgreSQL', mysql: 'MySQL' } as const

/** Core rules, then each built-in adapter's rules. */
export function allRules(): Rule[] {
  return [...coreRules, ...adapters.flatMap((a) => a.rules)]
}

/** `orm-preflight rules`: every rule with its category, default severity, and databases. */
export function formatRules(): string {
  const rows = allRules().map((r) => [
    r.meta.id,
    r.meta.category,
    r.meta.defaultSeverity,
    r.meta.dialects.map((d) => DATABASES[d]).join(', '),
  ])
  const table = [['Rule', 'Category', 'Default', 'Databases'], ...rows]
  const widths = [0, 1, 2].map((i) => Math.max(...table.map((row) => (row[i] ?? '').length)))
  const lines = table.map((row) =>
    row
      .map((cell, i) => cell.padEnd(widths[i] ?? 0))
      .join('  ')
      .trimEnd(),
  )
  return `${lines.join('\n')}\n\nRun "orm-preflight explain <rule>" for a rule's documentation.\n`
}

/** `orm-preflight explain <rule>`: the rule's Markdown documentation. */
export function explain(ruleId: string): string {
  const doc = ruleDocs[ruleId]
  if (doc !== undefined) return doc
  const ids = Object.keys(ruleDocs)
  // Adapter rules are also matched without their prefix, such as "no-changecolumn-recreate".
  const unprefixed = new Map(ids.map((id) => [id.slice(id.indexOf('/') + 1), id]))
  const near = closest(ruleId, [...ids, ...unprefixed.keys()])
  const suggestion = near === undefined ? undefined : (unprefixed.get(near) ?? near)
  throw new UsageError(
    `Unknown rule "${ruleId}".${suggestion === undefined ? '' : ` Did you mean "${suggestion}"?`} Run "orm-preflight rules" to list every rule.`,
  )
}

/**
 * `orm-preflight init`: writes a starter orm-preflight.config.json. startAfter is set to the
 * newest existing migration, so a project can adopt the tool without fixing its history.
 * Migration files are only read, never run. Returns the message to print.
 */
export async function init(
  cwd: string,
  patterns: readonly string[],
  overrides: ConfigOverrides,
): Promise<string> {
  const file = path.join(cwd, CONFIG_FILE)
  if (existsSync(file)) throw new UsageError(`${CONFIG_FILE} already exists.`)
  const pkg = path.join(cwd, 'package.json')
  if (existsSync(pkg) && hasPackageConfig(readFileSync(pkg, 'utf8'))) {
    throw new UsageError(`package.json already has an "${PACKAGE_KEY}" config.`)
  }

  const defaults = resolveConfig({}, undefined, overrides)
  const adapter = getAdapter(defaults.orm)
  if (adapter === undefined) throw new UsageError(`Unknown ORM "${defaults.orm}".`)

  const files = await discoverFiles(
    cwd,
    patterns.length > 0 ? patterns : adapter.defaultMigrationGlobs,
  )
  const ctx = { dialect: defaults.dialect, options: {} }
  const timestamps = await Promise.all(
    files.map(async (f) => {
      const text = await readFile(path.join(cwd, f), 'utf8')
      return adapter.extract({ path: f, text }, ctx).map((m) => m.timestamp)
    }),
  )
  const known = timestamps.flat().filter((t): t is number => t !== null)
  const startAfter = known.length > 0 ? Math.max(...known) : undefined

  const config: Record<string, unknown> = {
    $schema: './node_modules/orm-preflight/schema.json',
    orm: defaults.orm,
    dialect: defaults.dialect,
  }
  if (defaults.dialect === 'postgres') config.postgresVersion = defaults.postgresVersion
  if (patterns.length > 0) config.migrations = [...patterns]
  if (startAfter !== undefined) config.startAfter = startAfter
  if (adapter.starterOptions !== undefined) config[adapter.id] = adapter.starterOptions
  resolveConfig(config, CONFIG_FILE)
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`)

  const lines = [`Wrote ${CONFIG_FILE}.`]
  lines.push(
    startAfter === undefined
      ? 'No existing migrations were found, so every migration will be checked.'
      : `startAfter is ${String(startAfter)}, the newest of ${String(known.length)} existing migrations, so only migrations added after it are checked.`,
  )
  if (patterns.length === 0) {
    lines.push(
      `Migrations are found in the default location: ${adapter.defaultMigrationGlobs.filter((g) => !g.startsWith('!')).join(', ')}`,
    )
  }
  if (adapter.starterNote !== undefined) lines.push(adapter.starterNote)
  return `${lines.join('\n')}\n`
}

function hasPackageConfig(text: string): boolean {
  try {
    const manifest = JSON.parse(text) as Record<string, unknown> | null
    return manifest?.[PACKAGE_KEY] !== undefined
  } catch {
    return false
  }
}
