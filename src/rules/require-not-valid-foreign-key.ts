import { docsUrl, opsOf, table } from './helpers.js'
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
        return {
          op,
          // Skipped only when the referencing table is new: it has no rows to check.
          target: { table: op.table },
          message: `Adding ${op.name === undefined ? 'a foreign key' : `foreign key "${op.name}"`} on ${table(op.table, ctx)} checks every row while blocking writes to ${tables}.`,
          why: 'Adding a foreign key validates every existing row while holding a SHARE ROW EXCLUSIVE lock on both tables, which blocks INSERT, UPDATE, and DELETE until the check finishes.',
          safeAlternative:
            'Add the constraint with NOT VALID, then run ALTER TABLE ... VALIDATE CONSTRAINT in a separate migration. VALIDATE holds only a SHARE UPDATE EXCLUSIVE lock, which does not block writes. TypeORM builder calls cannot add NOT VALID, so use queryRunner.query().',
        }
      })
  },
}
