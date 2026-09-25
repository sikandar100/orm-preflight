import { docsUrl, opsOf, table } from './helpers.js'
import type { Rule } from './types.js'

export const requireConcurrentIndex: Rule = {
  meta: {
    id: 'require-concurrent-index',
    category: 'locking',
    defaultSeverity: 'error',
    dialects: ['postgres'],
    docsUrl: docsUrl('require-concurrent-index'),
  },
  check(migration, ctx) {
    return opsOf(migration.up, 'create_index')
      .filter((op) => !op.concurrently)
      .map((op) => ({
        op,
        target: { table: op.table },
        message: `Creating ${op.name === undefined ? 'an index' : `index "${op.name}"`} without CONCURRENTLY blocks writes to ${table(op.table, ctx)} until the build finishes.`,
        why: 'CREATE INDEX holds a SHARE lock on the table for the whole build, which blocks INSERT, UPDATE, and DELETE. On a large table that can take minutes.',
        safeAlternative:
          'Use CREATE INDEX CONCURRENTLY (or isConcurrent: true on a TableIndex) in a migration that runs outside a transaction: with TypeORM, set transaction = false on the migration and migrationsTransactionMode: "each" in the DataSource. If a concurrent build fails it leaves an INVALID index; drop it before retrying.',
      }))
  },
}
