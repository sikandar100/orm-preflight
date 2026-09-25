/** A table name, with its schema when the source states one. */
export interface TableRef {
  schema?: string
  name: string
}

/** A position in a source file. Lines and columns are 1-based. */
export interface Loc {
  file: string
  line: number
  column: number
}

export interface OpBase {
  loc: Loc
  origin: 'sql' | 'builder' | 'execute'
  /** True when the operation runs inside a condition, loop, or callback. */
  conditional?: boolean
  /** The SQL statement this operation came from. */
  sql?: string
  /**
   * Set when the statement shares one query() call with other statements. PostgreSQL runs
   * such a batch in one implicit transaction.
   */
  batch?: { index: number; size: number }
}

export type ConstraintType = 'foreign_key' | 'check' | 'unique' | 'primary_key'

export type OperationBody =
  | { kind: 'create_table'; table: TableRef }
  | { kind: 'drop_table'; table: TableRef }
  | { kind: 'rename_table'; table: TableRef; to: string }
  | {
      kind: 'add_column'
      table: TableRef
      column: string
      type?: string
      notNull: boolean
      default?: { expr: string; volatile: boolean }
      /** Identity and stored generated columns rewrite an existing table. */
      generated?: 'identity' | 'stored'
    }
  | { kind: 'drop_column'; table: TableRef; column: string }
  | { kind: 'rename_column'; table: TableRef; column: string; to: string }
  | {
      kind: 'alter_column_type'
      table: TableRef
      column: string
      to: string
      toTypmods?: number[]
      using: boolean
    }
  | { kind: 'set_not_null'; table: TableRef; column: string }
  | {
      kind: 'add_constraint'
      table: TableRef
      name?: string
      type: ConstraintType
      notValid: boolean
      usingIndex?: string
      references?: TableRef
    }
  | { kind: 'validate_constraint'; table: TableRef; name: string }
  | { kind: 'drop_constraint'; table: TableRef; name?: string; type?: ConstraintType }
  | { kind: 'create_index'; table: TableRef; name?: string; unique: boolean; concurrently: boolean }
  | { kind: 'drop_index'; name?: string; concurrently: boolean }
  | { kind: 'truncate'; tables: TableRef[] }
  | { kind: 'enum_rename'; from: string; to: string }
  | { kind: 'enum_create'; name: string }
  | { kind: 'enum_drop'; name: string }
  | { kind: 'enum_add_value'; name: string; value: string }
  | { kind: 'set_setting'; name: string; value: string }
  | {
      kind: 'maintenance'
      command: 'vacuum_full' | 'cluster' | 'reindex'
      concurrently: boolean
    }
  | {
      kind: 'typeorm.change_column'
      table: TableRef
      column: string
      recreates: 'yes' | 'no' | 'unknown'
    }
  /** BEGIN, COMMIT, or ROLLBACK, from SQL or from QueryRunner transaction methods. */
  | { kind: 'transaction_control'; action: 'start' | 'commit' | 'rollback' }
  /** An explicit LOCK TABLE statement. */
  | { kind: 'lock_table'; tables: TableRef[]; mode: string }
  | { kind: 'unanalyzable'; reason: string }

export type Operation = OpBase & OperationBody

/** A run of SQL characters that map to consecutive columns on one source line. */
export interface SqlSourceRun {
  /** Offset of the run's first character in the SQL string. */
  offset: number
  line: number
  column: number
}

/**
 * Maps offsets in an extracted SQL string back to the source file. It accounts for
 * escape sequences, line breaks, and strings joined with `+`.
 */
export interface SqlSourceMap {
  file: string
  runs: SqlSourceRun[]
}

/** A suppression comment. Parsed from source in M3. */
export interface Suppression {
  ruleId: string
  reason: string
  loc: Loc
  scope: 'next' | 'file'
}

/** One step of a migration as the adapter found it, before SQL is parsed. */
export type ExtractedStep =
  | {
      kind: 'sql'
      sql: string
      /** Location of the call that runs the SQL. */
      loc: Loc
      conditional?: boolean
      map: SqlSourceMap
    }
  | { kind: 'operation'; operation: Operation }

interface MigrationBase {
  adapter: string
  file: string
  id: string
  /** Null when the name does not end with a valid timestamp. */
  timestamp: number | null
  runsInTransaction: boolean | 'unknown'
  downIsEmpty: boolean
  suppressions: Suppression[]
  adapterData?: Record<string, unknown>
}

/** Adapter output. The core parse stage turns it into an AnalyzedMigration. */
export interface ExtractedMigration extends MigrationBase {
  up: ExtractedStep[]
}

export interface AnalyzedMigration extends MigrationBase {
  up: Operation[]
}
