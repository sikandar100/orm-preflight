import { docsUrl, opsOf, table } from './helpers.js'
import type { Rule } from './types.js'

export const requireConcurrentUnique: Rule = {
  meta: {
    id: 'require-concurrent-unique',
    category: 'locking',
    defaultSeverity: 'error',
    dialects: ['postgres'],
    docsUrl: docsUrl('require-concurrent-unique'),
  },
  check(migration, ctx) {
    return opsOf(migration.up, 'add_constraint')
      .filter((op) => (op.type === 'unique' || op.type === 'primary_key') && !op.usingIndex)
      .map((op) => {
        const kind = op.type === 'unique' ? 'unique constraint' : 'primary key'
        return {
          op,
          target: { table: op.table },
          message: `Adding ${op.name === undefined ? `a ${kind}` : `${kind} "${op.name}"`} on ${table(op.table, ctx)} builds an index while blocking reads and writes to ${table(op.table, ctx)}.`,
          why: 'ADD UNIQUE and ADD PRIMARY KEY build their index while holding an ACCESS EXCLUSIVE lock, which blocks every read and write until the build finishes.',
          safeAlternative:
            'Build the index first with CREATE UNIQUE INDEX CONCURRENTLY, in a migration that runs outside a transaction. Then attach it with ALTER TABLE ... ADD CONSTRAINT ... UNIQUE USING INDEX (or PRIMARY KEY USING INDEX), which only needs a brief lock. A primary key also needs its columns to be NOT NULL (see no-set-not-null).',
        }
      })
  },
}
