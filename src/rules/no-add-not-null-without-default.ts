import { column, docsUrl, opsOf, table } from './helpers.js'
import type { Rule } from './types.js'

export const noAddNotNullWithoutDefault: Rule = {
  meta: {
    id: 'no-add-not-null-without-default',
    category: 'locking',
    defaultSeverity: 'error',
    dialects: ['postgres'],
    docsUrl: docsUrl('no-add-not-null-without-default'),
  },
  check(migration, ctx) {
    return opsOf(migration.up, 'add_column')
      .filter((op) => op.notNull && op.default === undefined && op.generated === undefined)
      .map((op) => ({
        op,
        target: { table: op.table, column: op.column },
        message: `${column(op.table, op.column, ctx)} is added as NOT NULL without a default. The migration fails as soon as ${table(op.table, ctx)} has any rows.`,
        why: 'PostgreSQL fills a new column with its default for every existing row. With no default that value is NULL, which the NOT NULL constraint rejects.',
        safeAlternative:
          'Add the column as nullable, backfill it in batches, then enforce NOT NULL without a long lock (see no-set-not-null). Or add it with a constant default, which PostgreSQL 11 and later add without rewriting the table.',
      }))
  },
}
