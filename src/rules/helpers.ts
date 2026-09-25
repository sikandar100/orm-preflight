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
