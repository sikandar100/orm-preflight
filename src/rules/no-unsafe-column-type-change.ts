import { column, docsUrl, opsOf, table } from './helpers.js'
import type { Rule } from './types.js'

/**
 * Target types that are safe from a varchar or text column: a longer varchar, text, or an
 * unlimited varchar. A single migration does not show the old type, so these are not
 * reported (widening a varchar is exactly the fix recommended for TypeORM's column recreate).
 */
function maySafelyWiden(to: string): boolean {
  return to === 'text' || to === 'varchar' || /^varchar\(\d+\)$/.test(to)
}

export const noUnsafeColumnTypeChange: Rule = {
  meta: {
    id: 'no-unsafe-column-type-change',
    category: 'locking',
    defaultSeverity: 'error',
    dialects: ['postgres'],
    docsUrl: docsUrl('no-unsafe-column-type-change'),
  },
  check(migration, ctx) {
    return opsOf(migration.up, 'alter_column_type')
      .filter((op) => op.using || !maySafelyWiden(op.to))
      .map((op) => ({
        op,
        target: { table: op.table, column: op.column },
        message: `Changing the type of ${column(op.table, op.column, ctx)} to ${op.to}${op.using ? ' with a USING expression' : ''} rewrites the whole ${table(op.table, ctx)} table while blocking reads and writes.`,
        why: 'ALTER COLUMN ... TYPE holds an ACCESS EXCLUSIVE lock and rewrites the table and its indexes, unless the old and new types store values the same way (such as a longer varchar, or varchar to text).',
        safeAlternative:
          'Expand and contract: add a column with the new type, backfill it in batches, switch the code to it, and drop the old column in a later release.',
      }))
  },
}
