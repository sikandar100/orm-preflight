import type { Dialect } from '../rules/types.js'
import { normalizeMysqlType, normalizePostgresType } from '../sql/type-names.js'
import type { OperationBody, TableRef } from './types.js'

export interface NormalizeOptions {
  dialect: Dialect
  /** Schema for tables named without one. PostgreSQL's default is `public`. */
  defaultSchema?: string | undefined
}

/**
 * Makes operations from SQL and from builder calls comparable: every table gets a schema
 * (the default when none was written), and types use canonical names (`int` becomes `int4`).
 */
export function normalizeOperation<T extends OperationBody>(op: T, options: NormalizeOptions): T {
  const table = (ref: TableRef): TableRef =>
    ref.schema !== undefined || options.defaultSchema === undefined
      ? ref
      : { schema: options.defaultSchema, name: ref.name }
  const type = (t: string): string =>
    options.dialect === 'postgres' ? normalizePostgresType(t) : normalizeMysqlType(t)

  const out: Record<string, unknown> = { ...op }
  if ('table' in op) out.table = table(op.table)
  if ('tables' in op) out.tables = op.tables.map(table)
  if (op.kind === 'add_constraint' && op.references !== undefined)
    out.references = table(op.references)
  if (op.kind === 'add_column' && op.type !== undefined) out.type = type(op.type)
  if (op.kind === 'alter_column_type') out.to = type(op.to)
  return out as T
}

export function defaultSchemaFor(dialect: Dialect): string | undefined {
  return dialect === 'postgres' ? 'public' : undefined
}
