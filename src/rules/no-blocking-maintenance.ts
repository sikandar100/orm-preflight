import { docsUrl, opsOf } from './helpers.js'
import type { Rule } from './types.js'

const COMMANDS = {
  vacuum_full: {
    message:
      'VACUUM FULL rewrites the whole table while blocking reads and writes. Inside a transaction, PostgreSQL rejects it: "VACUUM cannot run inside a transaction block".',
    safe: 'Do not run VACUUM FULL from a migration. Run it in a maintenance window, or use a tool that rebuilds tables online, such as pg_repack.',
  },
  cluster: {
    message: 'CLUSTER rewrites the whole table in index order while blocking reads and writes.',
    safe: 'Do not run CLUSTER from a migration. Run it in a maintenance window, or use a tool that rebuilds tables online, such as pg_repack.',
  },
  reindex: {
    message:
      'REINDEX without CONCURRENTLY blocks writes to the table, and reads that use the index, until the rebuild finishes.',
    safe: 'Use REINDEX ... CONCURRENTLY, alone in its query() call, in a migration that runs outside a transaction: with TypeORM, set transaction = false on the migration and migrationsTransactionMode: "each" in the DataSource.',
  },
} as const

export const noBlockingMaintenance: Rule = {
  meta: {
    id: 'no-blocking-maintenance',
    category: 'locking',
    // Spec default: error. New rules ship at warn in a minor release (CONTRIBUTING).
    defaultSeverity: 'warn',
    dialects: ['postgres'],
    docsUrl: docsUrl('no-blocking-maintenance'),
  },
  check(migration) {
    return opsOf(migration.up, 'maintenance')
      .filter((op) => !op.concurrently)
      .map((op) => ({
        op,
        message: COMMANDS[op.command].message,
        why: 'VACUUM FULL and CLUSTER take an ACCESS EXCLUSIVE lock and write a new copy of the table. REINDEX takes a SHARE lock on the table and an exclusive lock on each index it rebuilds. The lock is held until the command finishes, which on a large table can take minutes or hours.',
        safeAlternative: COMMANDS[op.command].safe,
      }))
  },
}
