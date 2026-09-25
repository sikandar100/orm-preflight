import { docsUrl, opsOf, table } from './helpers.js'
import type { Rule } from './types.js'

export const noRenameTable: Rule = {
  meta: {
    id: 'no-rename-table',
    category: 'deploy-safety',
    defaultSeverity: 'error',
    dialects: ['postgres', 'mysql'],
    docsUrl: docsUrl('no-rename-table'),
  },
  check(migration, ctx) {
    return opsOf(migration.up, 'rename_table').map((op) => ({
      op,
      target: { table: op.table },
      message: `${table(op.table, ctx)} is renamed to "${op.to}". Running instances of the old code still use the old name and fail until they are replaced.`,
      why: 'During a rolling deploy, the old and new versions of the application run at the same time. Renaming a table breaks the old version immediately.',
      safeAlternative:
        'Create the new table (or a view with the old name for compatibility), copy the data, switch the code, and drop the old table in a later release.',
    }))
  },
}
