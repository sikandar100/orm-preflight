import type { Operation } from '../ir/types.js'
import { docsUrl } from './helpers.js'
import type { Rule, RuleFinding } from './types.js'

/** Statements PostgreSQL refuses to run inside a transaction block. */
function concurrentStatement(op: Operation): string | undefined {
  if (op.kind === 'create_index' && op.concurrently) return 'CREATE INDEX CONCURRENTLY'
  if (op.kind === 'drop_index' && op.concurrently) return 'DROP INDEX CONCURRENTLY'
  if (op.kind === 'maintenance' && op.command === 'reindex' && op.concurrently)
    return 'REINDEX CONCURRENTLY'
  return undefined
}

const SAFE =
  'Run the statement on its own, in its own query() call, in a migration that runs outside a transaction. With TypeORM: set transaction = false on the migration and migrationsTransactionMode: "each" in the DataSource (and in the typeorm.transactionMode config).'

export const concurrentIndexTransaction: Rule = {
  meta: {
    id: 'concurrent-index-transaction',
    category: 'locking',
    defaultSeverity: 'error',
    dialects: ['postgres'],
    docsUrl: docsUrl('concurrent-index-transaction'),
  },
  check(migration) {
    const findings: RuleFinding[] = []
    // Follow COMMIT and BEGIN written inside the migration, which some projects use to
    // leave the migration's transaction for a concurrent build.
    let inTransaction: boolean | 'unknown' = migration.runsInTransaction
    for (const op of migration.up) {
      if (op.kind === 'transaction_control') {
        inTransaction = op.action === 'start'
        continue
      }
      const statement = concurrentStatement(op)
      if (statement === undefined) continue
      const why =
        'PostgreSQL cannot run this statement inside a transaction block. A query() string with several statements also runs as one implicit transaction.'
      if (op.batch !== undefined) {
        findings.push({
          op,
          message: `${statement} shares one query() call with ${String(op.batch.size - 1)} other statement${op.batch.size === 2 ? '' : 's'}, so PostgreSQL runs them in one implicit transaction and rejects it.`,
          why,
          safeAlternative: SAFE,
        })
      } else if (inTransaction === true) {
        findings.push({
          op,
          message: `${statement} runs inside the migration's transaction, and PostgreSQL rejects it: "cannot run inside a transaction block".`,
          why,
          safeAlternative: SAFE,
        })
      } else if (inTransaction === 'unknown') {
        findings.push({
          op,
          downgrade: true,
          message: `${statement} fails if this migration runs inside a transaction, and orm-preflight cannot tell whether it does: the migration's transaction setting is not a constant.`,
          why,
          safeAlternative: SAFE,
        })
      }
    }
    return findings
  },
}
