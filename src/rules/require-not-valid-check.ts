import { docsUrl, opsOf, table } from './helpers.js'
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
      .map((op) => ({
        op,
        target: { table: op.table },
        message: `Adding ${op.name === undefined ? 'a check constraint' : `check constraint "${op.name}"`} on ${table(op.table, ctx)} checks every row while blocking reads and writes to ${table(op.table, ctx)}.`,
        why: 'Adding a CHECK constraint scans the whole table to validate the existing rows, and holds an ACCESS EXCLUSIVE lock until the scan finishes.',
        safeAlternative:
          'Add the constraint with NOT VALID, which applies it to new and changed rows without a scan. Then run ALTER TABLE ... VALIDATE CONSTRAINT in a separate migration; it holds only a SHARE UPDATE EXCLUSIVE lock, which does not block reads or writes. TypeORM builder calls cannot add NOT VALID, so use queryRunner.query().',
      }))
  },
}
