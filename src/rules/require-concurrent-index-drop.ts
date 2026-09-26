import { docsUrl, opsOf } from './helpers.js'
import type { Rule } from './types.js'

export const requireConcurrentIndexDrop: Rule = {
  meta: {
    id: 'require-concurrent-index-drop',
    category: 'locking',
    defaultSeverity: 'warn',
    dialects: ['postgres'],
    docsUrl: docsUrl('require-concurrent-index-drop'),
  },
  check(migration) {
    // An index created earlier in the same migration is not in use yet.
    const created = new Set(
      opsOf(migration.up, 'create_index').flatMap((op) => (op.name === undefined ? [] : [op.name])),
    )
    return opsOf(migration.up, 'drop_index')
      .filter((op) => !op.concurrently && !(op.name !== undefined && created.has(op.name)))
      .map((op) => ({
        op,
        message: `Dropping ${op.name === undefined ? 'an index' : `index "${op.name}"`} without CONCURRENTLY blocks reads and writes on its table until the drop finishes.`,
        why: 'DROP INDEX takes an ACCESS EXCLUSIVE lock on the table. The drop itself is quick, but it first waits for every running query on the table, and every query that arrives meanwhile waits behind it.',
        safeAlternative:
          'Use DROP INDEX CONCURRENTLY, alone in its query() call, in a migration that runs outside a transaction: with TypeORM, set transaction = false on the migration and migrationsTransactionMode: "each" in the DataSource.',
      }))
  },
}
