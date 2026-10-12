import type { Operation, TableRef } from '../ir/types.js'
import { docsUrl, table, tableKey } from './helpers.js'
import type { Rule, RuleFinding } from './types.js'

/** A constraint added with NOT VALID whose transaction has not committed yet. */
interface Pending {
  table: TableRef
  name: string
  type: 'check' | 'foreign_key'
  references: TableRef | undefined
  /** Set while later statements of the same query() call follow, sharing its implicit transaction. */
  batch: { index: number; size: number } | undefined
  /** Whether the migration's transaction keeps it uncommitted after the batch. */
  inTransaction: boolean | 'unknown'
}

const SAFE =
  'Validate in a transaction of its own, after the one that added the constraint has committed. With TypeORM, migrationsTransactionMode "all" (the default) runs every pending migration in one transaction, so a VALIDATE in a separate migration only helps when it is deployed in a later release, or with "each".'

export const validateInSameTransaction: Rule = {
  meta: {
    id: 'validate-in-same-transaction',
    category: 'locking',
    defaultSeverity: 'warn',
    dialects: ['postgres'],
    docsUrl: docsUrl('validate-in-same-transaction'),
  },
  check(migration, ctx) {
    const findings: RuleFinding[] = []
    let inTransaction: boolean | 'unknown' = migration.runsInTransaction
    let pending: Pending[] = []
    for (const op of migration.up) {
      if (op.kind === 'transaction_control') {
        // COMMIT or ROLLBACK ends the transaction; either way nothing is pending any more.
        pending = []
        inTransaction = op.action === 'start'
        continue
      }
      for (const p of pending) {
        if (p.batch !== undefined && !sameBatch(op, p.batch)) p.batch = undefined
      }
      pending = pending.filter((p) => p.batch !== undefined || p.inTransaction !== false)

      if (op.kind === 'validate_constraint') {
        const p = pending.find(
          (c) => c.name === op.name && tableKey(c.table) === tableKey(op.table),
        )
        if (p !== undefined) findings.push(finding(op, p, ctx))
      }
      const added = pendingConstraint(op, inTransaction)
      if (added !== undefined) pending.push(added)
    }
    return findings
  },
}

function finding(op: Operation, p: Pending, ctx: Parameters<Rule['check']>[1]): RuleFinding {
  const certain = p.batch !== undefined || p.inTransaction === true
  const name = `"${p.name}"`
  const lock =
    p.type === 'check'
      ? `the ACCESS EXCLUSIVE lock from adding it blocks reads and writes to ${table(p.table, ctx)}`
      : `the SHARE ROW EXCLUSIVE lock from adding it blocks writes to ${table(p.table, ctx)}${p.references === undefined ? '' : ` and ${table(p.references, ctx)}`}`
  return {
    op,
    target: { table: p.table },
    ...(certain ? {} : { cap: 'warn' as const }),
    message: certain
      ? `VALIDATE CONSTRAINT ${name} runs in the same transaction that added it NOT VALID, so it gains nothing: ${lock} until the transaction commits, and the validation reads the whole table under that lock.`
      : `VALIDATE CONSTRAINT ${name} runs in the same migration that added it NOT VALID. If the migration runs in a transaction, it gains nothing: ${lock} until the transaction commits. orm-preflight cannot tell, because the migration's transaction setting is not a constant.`,
    why: 'NOT VALID skips the table scan when the constraint is added, and VALIDATE CONSTRAINT checks the rows later under a weaker lock. Locks last until the transaction ends, so the weaker lock only helps once the transaction that added the constraint has committed.',
    safeAlternative: SAFE,
  }
}

function pendingConstraint(op: Operation, inTransaction: boolean | 'unknown'): Pending | undefined {
  if (op.kind !== 'add_constraint' || !op.notValid || op.name === undefined) return undefined
  if (op.type !== 'check' && op.type !== 'foreign_key') return undefined
  const batch = op.batch !== undefined && op.batch.index < op.batch.size - 1 ? op.batch : undefined
  // Outside a transaction and last in its call, the constraint is committed right away.
  if (inTransaction === false && batch === undefined) return undefined
  return {
    table: op.table,
    name: op.name,
    type: op.type,
    references: op.references,
    batch,
    inTransaction,
  }
}

/** Whether `op` comes later in the same query() call as the statement at `batch`. */
function sameBatch(op: Operation, batch: { index: number; size: number }): boolean {
  return op.batch?.size === batch.size && op.batch.index > batch.index
}
