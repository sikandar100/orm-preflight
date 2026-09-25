import { docsUrl, opsOf, table } from './helpers.js'
import type { Rule } from './types.js'

export const noDropTable: Rule = {
  meta: {
    id: 'no-drop-table',
    category: 'data-loss',
    defaultSeverity: 'error',
    dialects: ['postgres', 'mysql'],
    docsUrl: docsUrl('no-drop-table'),
  },
  check(migration, ctx) {
    return opsOf(migration.up, 'drop_table').map((op) => ({
      op,
      target: { table: op.table },
      message: `${table(op.table, ctx)} is dropped, which deletes all of its rows.`,
      why: 'Dropping a table deletes its data immediately. Application code that still uses the table fails until every running instance has the new version.',
      safeAlternative:
        'Remove the entity and deploy that first. Drop the table in a later release, then suppress this finding with a reason.',
    }))
  },
}
