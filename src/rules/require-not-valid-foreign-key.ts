import { column, docsUrl, nullColumnsBefore, opsOf, table } from './helpers.js'
import type { Rule } from './types.js'

export const requireNotValidForeignKey: Rule = {
  meta: {
    id: 'require-not-valid-foreign-key',
    category: 'locking',
    defaultSeverity: 'error',
    dialects: ['postgres'],
    docsUrl: docsUrl('require-not-valid-foreign-key'),
  },
  check(migration, ctx) {
    return opsOf(migration.up, 'add_constraint')
      .filter((op) => op.type === 'foreign_key' && !op.notValid)
      .map((op) => {
        const tables =
          op.references === undefined
            ? table(op.table, ctx)
            : `${table(op.table, ctx)} and ${table(op.references, ctx)}`
        const label = op.name === undefined ? 'a foreign key' : `foreign key "${op.name}"`
        const nulls = nullColumnsBefore(migration.up, op, op.table)
        const fkColumns = op.columns ?? []
        // MATCH SIMPLE skips a row when any of its columns is NULL; MATCH FULL needs all NULL.
        const skipped =
          fkColumns.length > 0 &&
          (op.match === 'full'
            ? fkColumns.every((c) => nulls.has(c))
            : fkColumns.some((c) => nulls.has(c)))
        if (skipped) {
          const columns = fkColumns
            .filter((c) => nulls.has(c))
            .map((c) => column(op.table, c, ctx))
            .join(' and ')
          return {
            op,
            target: { table: op.table },
            cap: 'info' as const,
            message: `Adding ${label} on ${table(op.table, ctx)} cannot fail: ${columns} was added earlier in this migration, so every row has NULL there. PostgreSQL still reads the whole table once while blocking writes to ${tables}.`,
            why: 'PostgreSQL does not check rows whose foreign key columns are NULL. With the new column NULL in every row, no existing row can break the foreign key. Validating it still takes one full read of the table under a SHARE ROW EXCLUSIVE lock on both tables.',
            safeAlternative:
              'Nothing needs to change. On a large table, adding the constraint with NOT VALID skips the read; existing rows cannot break it, and new rows are always checked.',
          }
        }
        return {
          op,
          // Skipped only when the referencing table is new: it has no rows to check.
          target: { table: op.table },
          message: `Adding ${label} on ${table(op.table, ctx)} checks every row while blocking writes to ${tables}.`,
          why: 'Adding a foreign key validates every existing row while holding a SHARE ROW EXCLUSIVE lock on both tables, which blocks INSERT, UPDATE, and DELETE until the check finishes.',
          safeAlternative:
            'Add the constraint with NOT VALID, then run ALTER TABLE ... VALIDATE CONSTRAINT in a separate migration. VALIDATE holds only a SHARE UPDATE EXCLUSIVE lock, which does not block writes. TypeORM builder calls cannot add NOT VALID, so use queryRunner.query().',
        }
      })
  },
}
