import type { AnalyzedMigration, Loc, TableRef } from '../ir/types.js'

export type Severity = 'error' | 'warn' | 'off'
export type Dialect = 'postgres' | 'mysql'

export interface RuleMeta {
  id: string
  category: 'data-loss' | 'locking' | 'deploy-safety' | 'correctness'
  defaultSeverity: Severity
  dialects: Dialect[]
  minPgVersion?: number
  /** A more specific rule hides these general rules on the same target. */
  supersedes?: string[]
  /** Set for adapter rules. The ID must then be `<adapter>/<name>`. */
  adapter?: string
  docsUrl: string
}

export interface Finding {
  ruleId: string
  severity: Severity
  loc: Loc
  message: string
  why: string
  safeAlternative?: string
  suppressed?: { reason: string }
}

export interface RuleContext {
  /** The resolved configuration. Its type is defined with the config loader in M3. */
  config: unknown
  pgVersion: number
  /** True when the table was created earlier in this migration or in this lint run. */
  isNewTable(table: TableRef): boolean
}

export interface Rule {
  meta: RuleMeta
  check(migration: AnalyzedMigration, ctx: RuleContext): Finding[]
}
