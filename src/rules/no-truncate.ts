import { docsUrl, opsOf, table } from './helpers.js'
import type { Rule } from './types.js'

export const noTruncate: Rule = {
  meta: {
    id: 'no-truncate',
    category: 'data-loss',
    defaultSeverity: 'error',
    dialects: ['postgres', 'mysql'],
    docsUrl: docsUrl('no-truncate'),
  },
  check(migration, ctx) {
    return opsOf(migration.up, 'truncate').flatMap((op) =>
      op.tables.map((t) => ({
        op,
        target: { table: t },
        message: `${table(t, ctx)} is truncated, which deletes all of its rows.`,
        why: 'TRUNCATE removes every row at once and cannot be undone once committed. It also takes an ACCESS EXCLUSIVE lock on the table.',
        safeAlternative:
          'Delete the rows you mean to remove in batches with DELETE and a WHERE clause, or suppress this finding with a reason.',
      })),
    )
  },
}
