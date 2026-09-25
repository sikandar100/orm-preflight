import { column, docsUrl, opsOf, table, tableKey } from './helpers.js'
import type { Rule } from './types.js'

export const noSetNotNull: Rule = {
  meta: {
    id: 'no-set-not-null',
    category: 'locking',
    defaultSeverity: 'error',
    dialects: ['postgres'],
    docsUrl: docsUrl('no-set-not-null'),
  },
  check(migration, ctx) {
    const up = migration.up
    return opsOf(up, 'set_not_null').flatMap((op) => {
      const i = up.indexOf(op)
      const sameTable = (other: (typeof up)[number]) =>
        'table' in other && tableKey(other.table) === tableKey(op.table)
      // The safe pattern proves NOT NULL with a validated CHECK first, then drops that
      // CHECK after SET NOT NULL. Either half in this migration means the pattern is in use.
      const provenBefore = up
        .slice(0, i)
        .some((o) => o.kind === 'validate_constraint' && sameTable(o))
      const checkDroppedAfter = up
        .slice(i + 1)
        .some((o) => o.kind === 'drop_constraint' && sameTable(o))
      if (provenBefore || checkDroppedAfter) return []

      const safeAlternative =
        ctx.pgVersion >= 18
          ? `PostgreSQL 18: add the constraint without checking rows, then validate it in a separate migration: ALTER TABLE ${table(op.table, ctx)} ADD CONSTRAINT <name> NOT NULL "${op.column}" NOT VALID, then ALTER TABLE ${table(op.table, ctx)} VALIDATE CONSTRAINT <name>. VALIDATE does not block writes.`
          : ctx.pgVersion >= 12
            ? `Add CHECK ("${op.column}" IS NOT NULL) NOT VALID, validate it in a separate migration, then SET NOT NULL (PostgreSQL skips the scan because the CHECK proves it) and drop the CHECK.`
            : 'Before PostgreSQL 12 there is no way to avoid the scan; run this in a maintenance window.'
      return [
        {
          op,
          target: { table: op.table, column: op.column },
          message: `${column(op.table, op.column, ctx)} is set to NOT NULL, which scans the whole ${table(op.table, ctx)} table while blocking reads and writes.`,
          why: 'SET NOT NULL holds an ACCESS EXCLUSIVE lock and checks every row, unless a validated CHECK constraint already proves the column has no NULLs.',
          safeAlternative,
        },
      ]
    })
  },
}
