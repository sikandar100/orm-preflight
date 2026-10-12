import { canFailWhenNull } from './check-nulls.js'
import { column, docsUrl, nullColumnsBefore, opsOf, table } from './helpers.js'
import type { CheckExpr } from '../ir/types.js'
import type { Rule } from './types.js'

export const requireNotValidCheck: Rule = {
  meta: {
    id: 'require-not-valid-check',
    category: 'locking',
    defaultSeverity: 'error',
    dialects: ['postgres'],
    docsUrl: docsUrl('require-not-valid-check'),
  },
  check(migration, ctx) {
    return opsOf(migration.up, 'add_constraint')
      .filter((op) => op.type === 'check' && !op.notValid)
      .map((op) => {
        const label = op.name === undefined ? 'a check constraint' : `check constraint "${op.name}"`
        const nulls = nullColumnsBefore(migration.up, op, op.table)
        const used = [...nulls].filter((c) => op.check !== undefined && mentions(op.check, c))
        if (op.check !== undefined && used.length > 0 && !canFailWhenNull(op.check, nulls)) {
          const columns = used.map((c) => column(op.table, c, ctx)).join(' and ')
          return {
            op,
            target: { table: op.table },
            cap: 'info' as const,
            message: `Adding ${label} on ${table(op.table, ctx)} cannot fail: ${columns} ${used.length === 1 ? 'was' : 'were'} added earlier in this migration, so every row has NULL there. PostgreSQL still reads the whole table once while blocking reads and writes.`,
            why: 'A CHECK constraint is satisfied when its expression is true or NULL. With the new column NULL in every row, the check cannot be false for any existing row. Validating it still takes one full read of the table under an ACCESS EXCLUSIVE lock.',
            safeAlternative:
              'Nothing needs to change. On a large table, adding the constraint with NOT VALID skips the read; existing rows cannot break it, and new rows are always checked.',
          }
        }
        return {
          op,
          target: { table: op.table },
          message: `Adding ${label} on ${table(op.table, ctx)} checks every row while blocking reads and writes to ${table(op.table, ctx)}.`,
          why: 'Adding a CHECK constraint scans the whole table to validate the existing rows, and holds an ACCESS EXCLUSIVE lock until the scan finishes.',
          safeAlternative:
            'Add the constraint with NOT VALID, which applies it to new and changed rows without a scan. Then run ALTER TABLE ... VALIDATE CONSTRAINT in a separate migration; it holds only a SHARE UPDATE EXCLUSIVE lock, which does not block reads or writes. TypeORM builder calls cannot add NOT VALID, so use queryRunner.query().',
        }
      })
  },
}

/** Whether the expression reads the column. */
function mentions(e: CheckExpr, name: string): boolean {
  switch (e.kind) {
    case 'column':
      return e.name === name
    case 'strict':
    case 'and':
    case 'or':
      return e.args.some((a) => mentions(a, name))
    case 'not':
    case 'is_null':
    case 'is_not_null':
      return mentions(e.arg, name)
    default:
      return false
  }
}
