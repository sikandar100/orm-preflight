import { column, docsUrl, opsOf } from './helpers.js'
import type { Rule } from './types.js'

export const noRenameColumn: Rule = {
  meta: {
    id: 'no-rename-column',
    category: 'deploy-safety',
    defaultSeverity: 'error',
    dialects: ['postgres', 'mysql'],
    docsUrl: docsUrl('no-rename-column'),
  },
  check(migration, ctx) {
    return opsOf(migration.up, 'rename_column').map((op) => ({
      op,
      target: { table: op.table, column: op.column },
      message: `${column(op.table, op.column, ctx)} is renamed to "${op.to}". Running instances of the old code still use "${op.column}" and fail until they are replaced.`,
      why: 'During a rolling deploy, the old and new versions of the application run at the same time. Renaming a column breaks the old version immediately.',
      safeAlternative:
        'Expand and contract: add the new column, write to both, backfill, switch reads to the new column, and drop the old one in a later release.',
    }))
  },
}
