import type { Operation, OperationBody, TableRef } from '../ir/types.js'
import type { RuleContext } from './types.js'

const DOCS_BASE = 'https://github.com/sikandar100/orm-preflight/blob/main/docs/rules'

/** Link to a rule's documentation. Adapter rules live in a folder named after the adapter. */
export function docsUrl(id: string): string {
  return `${DOCS_BASE}/${id}.md`
}

/** Operations of one kind, typed. */
export function opsOf<K extends OperationBody['kind']>(
  ops: readonly Operation[],
  kind: K,
): (Operation & { kind: K })[] {
  return ops.filter((op): op is Operation & { kind: K } => op.kind === kind)
}

/** `"users"`, or `"app"."users"` when the schema is not the default one. */
export function table(ref: TableRef, ctx: RuleContext): string {
  return ref.schema === undefined || ref.schema === ctx.defaultSchema
    ? `"${ref.name}"`
    : `"${ref.schema}"."${ref.name}"`
}

export function column(ref: TableRef, name: string, ctx: RuleContext): string {
  return `${table(ref, ctx)}."${name}"`
}

/** A stable key for a table, for sets and maps. */
export function tableKey(ref: TableRef): string {
  return JSON.stringify([ref.schema ?? '', ref.name])
}

/**
 * Columns of `ref` that are NULL in every row just before `before`: added earlier in the same
 * migration without a default or NOT NULL, and not written to since. Any INSERT, UPDATE, or
 * MERGE on the table in between may have filled them, so it clears the set.
 */
export function nullColumnsBefore(
  ops: readonly Operation[],
  before: Operation,
  ref: TableRef,
): Set<string> {
  const key = tableKey(ref)
  const nulls = new Set<string>()
  for (const op of ops) {
    if (op === before) break
    if (op.kind === 'add_column' && tableKey(op.table) === key) {
      if (op.default === undefined && !op.notNull && op.generated === undefined) {
        nulls.add(op.column)
      } else {
        nulls.delete(op.column)
      }
    } else if (
      op.kind === 'data_change' &&
      op.statement !== 'delete' &&
      tableKey(op.table) === key
    ) {
      nulls.clear()
    } else if (op.kind === 'unanalyzable') {
      // An unread statement could have written anything.
      nulls.clear()
    }
  }
  return nulls
}
