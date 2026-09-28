import type { Operation } from '../ir/types.js'
import { docsUrl } from './helpers.js'
import type { Rule, RuleFinding } from './types.js'

/** A value added by ALTER TYPE ... ADD VALUE that is not committed yet. */
interface Uncommitted {
  name: string
  /** The value as a SQL string literal, which is how later statements use it. */
  literal: string
  /** Set while later statements of the same query() call follow, sharing its implicit transaction. */
  batch: { index: number; size: number } | undefined
  /** Whether the migration's transaction keeps it uncommitted after the batch. */
  inTransaction: boolean | 'unknown'
}

export const enumValueUsedInSameTransaction: Rule = {
  meta: {
    id: 'enum-value-used-in-same-transaction',
    category: 'locking',
    defaultSeverity: 'error',
    dialects: ['postgres'],
    docsUrl: docsUrl('enum-value-used-in-same-transaction'),
  },
  check(migration) {
    const findings: RuleFinding[] = []
    let inTransaction: boolean | 'unknown' = migration.runsInTransaction
    let uncommitted: Uncommitted[] = []
    for (const op of migration.up) {
      if (op.kind === 'transaction_control') {
        // COMMIT or ROLLBACK ends the transaction; either way the value is no longer pending.
        uncommitted = []
        inTransaction = op.action === 'start'
        continue
      }
      for (const u of uncommitted) {
        if (u.batch !== undefined && !sameBatch(op, u.batch)) u.batch = undefined
      }
      uncommitted = uncommitted.filter((u) => u.batch !== undefined || u.inTransaction !== false)
      for (const u of uncommitted) {
        if (op.sql?.includes(u.literal) !== true) continue
        const certain = u.batch !== undefined || u.inTransaction === true
        findings.push({
          op,
          ...(certain ? {} : { downgrade: true }),
          message: certain
            ? `The new value ${u.literal} of enum "${u.name}" is used before the transaction that adds it commits. PostgreSQL rejects this: "unsafe use of new value".`
            : `The new value ${u.literal} of enum "${u.name}" is used in the same migration that adds it. If the migration runs in a transaction, PostgreSQL rejects this: "unsafe use of new value". orm-preflight cannot tell, because the migration's transaction setting is not a constant.`,
          why: 'A value added with ALTER TYPE ... ADD VALUE cannot be used until the transaction that added it commits, so the migration fails at this statement.',
          safeAlternative:
            'Add the value in one migration and use it in a later one. With migrationsTransactionMode "all", every pending migration shares one transaction, so use "each", or deploy the migration that uses the value separately.',
        })
      }
      const added = uncommittedValue(op, inTransaction)
      if (added !== undefined) uncommitted.push(added)
    }
    return findings
  },
}

function uncommittedValue(
  op: Operation,
  inTransaction: boolean | 'unknown',
): Uncommitted | undefined {
  if (op.kind !== 'enum_add_value') return undefined
  const batch = op.batch !== undefined && op.batch.index < op.batch.size - 1 ? op.batch : undefined
  // Outside a transaction and last in its call, the value is committed right away.
  if (inTransaction === false && batch === undefined) return undefined
  return { name: op.name, literal: `'${op.value.replaceAll("'", "''")}'`, batch, inTransaction }
}

/** Whether `op` comes later in the same query() call as the statement at `batch`. */
function sameBatch(op: Operation, batch: { index: number; size: number }): boolean {
  return op.batch?.size === batch.size && op.batch.index > batch.index
}
