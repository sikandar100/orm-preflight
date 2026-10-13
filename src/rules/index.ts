import { enumValueUsedInSameTransaction } from './enum-value-used-in-same-transaction.js'
import { noBlockingMaintenance } from './no-blocking-maintenance.js'
import { requireDown } from './require-down.js'
import { requireConcurrentIndexDrop } from './require-concurrent-index-drop.js'
import { requireConcurrentUnique } from './require-concurrent-unique.js'
import { requireLockTimeout } from './require-lock-timeout.js'
import { requireNotValidCheck } from './require-not-valid-check.js'
import { concurrentIndexTransaction } from './concurrent-index-transaction.js'
import { invalidSuppression } from './invalid-suppression.js'
import { noAddNotNullWithoutDefault } from './no-add-not-null-without-default.js'
import { noDropAndRecreateColumn } from './no-drop-and-recreate-column.js'
import { noDropColumn } from './no-drop-column.js'
import { noDropTable } from './no-drop-table.js'
import { noEditAppliedMigration } from './no-edit-applied-migration.js'
import { noRenameColumn } from './no-rename-column.js'
import { noRenameTable } from './no-rename-table.js'
import { noSetNotNull } from './no-set-not-null.js'
import { noDeleteRows } from './no-delete-rows.js'
import { noNullOutColumn } from './no-null-out-column.js'
import { noTruncate } from './no-truncate.js'
import { noTruncatingTypeChange } from './no-truncating-type-change.js'
import { noUnsafeColumnTypeChange } from './no-unsafe-column-type-change.js'
import { noVolatileDefault } from './no-volatile-default.js'
import { possibleRenameDataLoss } from './possible-rename-data-loss.js'
import { requireConcurrentIndex } from './require-concurrent-index.js'
import { requireNotValidForeignKey } from './require-not-valid-foreign-key.js'
import { rewritesExistingRows } from './rewrites-existing-rows.js'
import type { Rule } from './types.js'
import { validateInSameTransaction } from './validate-in-same-transaction.js'
import { unanalyzableStatement } from './unanalyzable-statement.js'

/** Core rules. Rule IDs are public API. */
export const coreRules: readonly Rule[] = [
  noDropAndRecreateColumn,
  possibleRenameDataLoss,
  noDropColumn,
  noDropTable,
  noTruncate,
  noTruncatingTypeChange,
  noDeleteRows,
  noNullOutColumn,
  rewritesExistingRows,
  noRenameColumn,
  noRenameTable,
  requireConcurrentIndex,
  concurrentIndexTransaction,
  noAddNotNullWithoutDefault,
  noVolatileDefault,
  noUnsafeColumnTypeChange,
  requireNotValidForeignKey,
  noSetNotNull,
  requireNotValidCheck,
  validateInSameTransaction,
  requireConcurrentUnique,
  requireConcurrentIndexDrop,
  noBlockingMaintenance,
  enumValueUsedInSameTransaction,
  requireLockTimeout,
  unanalyzableStatement,
  noEditAppliedMigration,
  requireDown,
  invalidSuppression,
]
