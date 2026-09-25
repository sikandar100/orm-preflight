import type { AnalyzedMigration, Loc, Operation, TableRef } from '../ir/types.js'

export type Severity = 'error' | 'warn' | 'off'
export type Dialect = 'postgres' | 'mysql'
export type Category = 'data-loss' | 'locking' | 'deploy-safety' | 'correctness'

export interface RuleMeta {
  id: string
  category: Category
  defaultSeverity: Severity
  dialects: Dialect[]
  minPgVersion?: number
  /** A more specific rule hides these general rules on the same table and column. */
  supersedes?: string[]
  /** Set for adapter rules. The ID must then be `<adapter>/<name>`. */
  adapter?: string
  docsUrl: string
}

/** What a rule reports. The engine turns it into a public finding. */
export interface RuleFinding {
  /** The operation the finding is about. Gives the location and any suppressions. */
  op?: Operation
  /** Location when there is no operation, such as a whole migration. */
  loc?: Loc
  message: string
  why: string
  safeAlternative?: string
  /** The table (and column) the finding is about, for new-table checks and de-duplication. */
  target?: { table: TableRef; column?: string }
  /**
   * Report as a warning even when the rule is configured as an error, because this case
   * cannot be confirmed statically. Rules may lower severity, never raise it.
   */
  downgrade?: boolean
}

export interface RuleContext {
  dialect: Dialect
  pgVersion: number
  /** Options for the active adapter, from its config key (for example `typeorm`). */
  adapterOptions: Readonly<Record<string, unknown>>
  /** Every rule ID that can be named in a suppression. */
  knownRuleIds: ReadonlySet<string>
  /** Tables in this schema are shown without it in messages. */
  defaultSchema: string | undefined
}

export interface Rule {
  meta: RuleMeta
  check(migration: AnalyzedMigration, ctx: RuleContext): RuleFinding[]
}

/** A finding as returned by lint() and printed by the JSON reporter. Public API. */
export interface Finding {
  ruleId: string
  severity: 'error' | 'warn'
  category: Category
  file: string
  line: number
  column: number
  message: string
  why: string
  safeAlternative: string | null
  docsUrl: string
  suppressed: { reason: string } | null
}
