export type TransactionMode = 'all' | 'each' | 'none'

/** The migration's `transaction` property: set to a literal, absent, or not resolvable. */
export type DeclaredTransaction = boolean | undefined | 'unknown'

/**
 * Whether TypeORM runs a migration's up() inside a transaction, following
 * MigrationExecutor.executePendingMigrations.
 *
 * In mode "all", every pending migration shares one transaction. A migration that sets
 * `transaction` makes TypeORM throw before running anything, which the
 * typeorm/transaction-override-forbidden rule reports, so the answer here stays true.
 */
export function runsInTransaction(
  mode: TransactionMode,
  declared: DeclaredTransaction,
): boolean | 'unknown' {
  if (mode === 'all') return true
  if (declared === undefined) return mode === 'each'
  return declared
}

export function resolveTransactionMode(
  options: Readonly<Record<string, unknown>>,
): TransactionMode {
  const mode = options.transactionMode ?? 'all'
  if (mode === 'all' || mode === 'each' || mode === 'none') return mode
  throw new Error(`typeorm.transactionMode must be "all", "each", or "none"`)
}
