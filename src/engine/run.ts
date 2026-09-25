import type { AnalyzedMigration, Suppression } from '../ir/types.js'
import { tableKey } from '../rules/helpers.js'
import type { Dialect, Finding, Rule, RuleContext, RuleFinding, Severity } from '../rules/types.js'

export interface EngineOptions {
  dialect: Dialect
  pgVersion: number
  /** Severity overrides from the config, by rule ID. */
  severities: Readonly<Record<string, Severity>>
  adapterOptions: Readonly<Record<string, unknown>>
  defaultSchema: string | undefined
  /**
   * When true, a table created by any migration in this run counts as new for every other
   * migration. Used when linting only changed migrations.
   */
  crossMigrationNewTables: boolean
}

/** Categories whose findings do not apply to a table created in the same change. */
const NEW_TABLE_EXEMPT = new Set(['data-loss', 'locking', 'deploy-safety'])

const CONDITIONAL_NOTE = ' It runs only on some code paths (inside a condition, loop, or callback).'

/** Runs every enabled rule on every migration and returns sorted, de-duplicated findings. */
export function runRules(
  migrations: readonly AnalyzedMigration[],
  rules: readonly Rule[],
  options: EngineOptions,
): Finding[] {
  const knownRuleIds = new Set(rules.map((r) => r.meta.id))
  const ctx: RuleContext = {
    dialect: options.dialect,
    pgVersion: options.pgVersion,
    adapterOptions: options.adapterOptions,
    knownRuleIds,
    defaultSchema: options.defaultSchema,
  }

  const enabled = rules.flatMap((rule) => {
    const severity = options.severities[rule.meta.id] ?? rule.meta.defaultSeverity
    if (severity === 'off') return []
    if (!rule.meta.dialects.includes(options.dialect)) return []
    if (options.dialect === 'postgres' && (rule.meta.minPgVersion ?? 0) > options.pgVersion)
      return []
    return [{ rule, severity }]
  })

  const createdInRun = new Set(
    migrations.flatMap((m) =>
      m.up.flatMap((op) => (op.kind === 'create_table' ? [tableKey(op.table)] : [])),
    ),
  )

  const findings: (Finding & { key?: string })[] = []
  for (const migration of migrations) {
    const created = options.crossMigrationNewTables
      ? createdInRun
      : new Set(
          migration.up.flatMap((op) => (op.kind === 'create_table' ? [tableKey(op.table)] : [])),
        )
    const valid = validSuppressions(migration.suppressions, knownRuleIds)

    for (const { rule, severity } of enabled) {
      for (const f of rule.check(migration, ctx)) {
        if (
          f.target &&
          NEW_TABLE_EXEMPT.has(rule.meta.category) &&
          created.has(tableKey(f.target.table))
        ) {
          continue
        }
        const loc = f.op?.loc ?? f.loc ?? migration.loc
        const finding: Finding & { key?: string } = {
          ruleId: rule.meta.id,
          severity: f.downgrade === true || severity === 'warn' ? 'warn' : 'error',
          category: rule.meta.category,
          file: loc.file,
          line: loc.line,
          column: loc.column,
          message: f.op?.conditional === true ? f.message + CONDITIONAL_NOTE : f.message,
          why: f.why,
          safeAlternative: f.safeAlternative ?? null,
          docsUrl: rule.meta.docsUrl,
          suppressed: suppressionFor(rule.meta.id, f, migration.suppressions, valid),
        }
        if (f.target) finding.key = targetKey(loc.file, f)
        findings.push(finding)
      }
    }
  }

  return sortFindings(dedupe(findings, rules))
}

/**
 * Reports broken suppression comments, so a comment must not be able to hide it. Only the
 * config can turn it off.
 */
export const UNSUPPRESSIBLE = 'invalid-suppression'

/** Indexes of suppressions that name a known rule and give a reason. */
function validSuppressions(
  suppressions: readonly Suppression[],
  known: ReadonlySet<string>,
): Set<number> {
  const valid = new Set<number>()
  suppressions.forEach((s, i) => {
    if (s.reason !== '' && known.has(s.ruleId) && s.ruleId !== UNSUPPRESSIBLE) valid.add(i)
  })
  return valid
}

function suppressionFor(
  ruleId: string,
  f: RuleFinding,
  suppressions: readonly Suppression[],
  valid: ReadonlySet<number>,
): { reason: string } | null {
  for (const [i, s] of suppressions.entries()) {
    if (!valid.has(i) || s.ruleId !== ruleId) continue
    if (s.scope === 'file' || f.op?.suppressions?.includes(i) === true) return { reason: s.reason }
  }
  return null
}

function targetKey(file: string, f: RuleFinding): string {
  return JSON.stringify([file, f.target ? tableKey(f.target.table) : '', f.target?.column ?? ''])
}

/**
 * One problem, one message: drops findings of a rule superseded by a more specific rule on
 * the same target, and exact duplicates (a file-level problem seen from several migrations).
 */
function dedupe(findings: (Finding & { key?: string })[], rules: readonly Rule[]): Finding[] {
  const hidden = new Set<string>()
  for (const f of findings) {
    const supersedes = rules.find((r) => r.meta.id === f.ruleId)?.meta.supersedes ?? []
    if (f.key !== undefined) for (const id of supersedes) hidden.add(JSON.stringify([id, f.key]))
  }
  const seen = new Set<string>()
  const out: Finding[] = []
  for (const { key, ...f } of findings) {
    if (key !== undefined && hidden.has(JSON.stringify([f.ruleId, key]))) continue
    const identity = JSON.stringify([f.ruleId, f.file, f.line, f.column, f.message])
    if (seen.has(identity)) continue
    seen.add(identity)
    out.push(f)
  }
  return out
}

/** Sorted by file, line, column, then rule, so output is the same on every run. */
export function sortFindings(findings: Finding[]): Finding[] {
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  return [...findings].sort(
    (a, b) =>
      compare(a.file, b.file) ||
      a.line - b.line ||
      a.column - b.column ||
      compare(a.ruleId, b.ruleId) ||
      compare(a.message, b.message),
  )
}
