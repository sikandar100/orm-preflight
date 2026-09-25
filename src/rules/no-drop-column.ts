import { column, docsUrl, opsOf } from './helpers.js'
import type { Rule } from './types.js'

export const noDropColumn: Rule = {
  meta: {
    id: 'no-drop-column',
    category: 'data-loss',
    defaultSeverity: 'error',
    dialects: ['postgres', 'mysql'],
    docsUrl: docsUrl('no-drop-column'),
  },
  check(migration, ctx) {
    return opsOf(migration.up, 'drop_column').map((op) => ({
      op,
      target: { table: op.table, column: op.column },
      message: `${column(op.table, op.column, ctx)} is dropped, which deletes every value in it.`,
      why: 'Dropping a column deletes its data immediately. Application code that still reads or writes the column fails until every running instance has the new version.',
      safeAlternative:
        'Remove the property from the entity and deploy that first. Drop the column in a later release, then suppress this finding with a reason.',
    }))
  },
}
