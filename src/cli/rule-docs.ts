// Rule docs, embedded in the build as text so `orm-preflight explain` works offline.
// test/cli/rule-docs.test.ts checks that every rule has an entry here.
import concurrentIndexTransaction from '../../docs/rules/concurrent-index-transaction.md'
import enumValueUsedInSameTransaction from '../../docs/rules/enum-value-used-in-same-transaction.md'
import invalidSuppression from '../../docs/rules/invalid-suppression.md'
import noAddNotNullWithoutDefault from '../../docs/rules/no-add-not-null-without-default.md'
import noBlockingMaintenance from '../../docs/rules/no-blocking-maintenance.md'
import noDropAndRecreateColumn from '../../docs/rules/no-drop-and-recreate-column.md'
import noDropColumn from '../../docs/rules/no-drop-column.md'
import noDropTable from '../../docs/rules/no-drop-table.md'
import noEditAppliedMigration from '../../docs/rules/no-edit-applied-migration.md'
import noRenameColumn from '../../docs/rules/no-rename-column.md'
import noRenameTable from '../../docs/rules/no-rename-table.md'
import noSetNotNull from '../../docs/rules/no-set-not-null.md'
import noTruncate from '../../docs/rules/no-truncate.md'
import noUnsafeColumnTypeChange from '../../docs/rules/no-unsafe-column-type-change.md'
import noVolatileDefault from '../../docs/rules/no-volatile-default.md'
import possibleRenameDataLoss from '../../docs/rules/possible-rename-data-loss.md'
import requireConcurrentIndex from '../../docs/rules/require-concurrent-index.md'
import requireConcurrentIndexDrop from '../../docs/rules/require-concurrent-index-drop.md'
import requireConcurrentUnique from '../../docs/rules/require-concurrent-unique.md'
import requireDown from '../../docs/rules/require-down.md'
import requireLockTimeout from '../../docs/rules/require-lock-timeout.md'
import requireNotValidCheck from '../../docs/rules/require-not-valid-check.md'
import requireNotValidForeignKey from '../../docs/rules/require-not-valid-foreign-key.md'
import typeormInvalidMigrationName from '../../docs/rules/typeorm/invalid-migration-name.md'
import typeormNoChangecolumnRecreate from '../../docs/rules/typeorm/no-changecolumn-recreate.md'
import typeormNoEnumRecreate from '../../docs/rules/typeorm/no-enum-recreate.md'
import typeormTransactionOverrideForbidden from '../../docs/rules/typeorm/transaction-override-forbidden.md'
import unanalyzableStatement from '../../docs/rules/unanalyzable-statement.md'

/** The Markdown documentation of each rule, by rule ID. */
export const ruleDocs: Readonly<Record<string, string>> = {
  'concurrent-index-transaction': concurrentIndexTransaction,
  'enum-value-used-in-same-transaction': enumValueUsedInSameTransaction,
  'invalid-suppression': invalidSuppression,
  'no-add-not-null-without-default': noAddNotNullWithoutDefault,
  'no-blocking-maintenance': noBlockingMaintenance,
  'no-drop-and-recreate-column': noDropAndRecreateColumn,
  'no-drop-column': noDropColumn,
  'no-drop-table': noDropTable,
  'no-edit-applied-migration': noEditAppliedMigration,
  'no-rename-column': noRenameColumn,
  'no-rename-table': noRenameTable,
  'no-set-not-null': noSetNotNull,
  'no-truncate': noTruncate,
  'no-unsafe-column-type-change': noUnsafeColumnTypeChange,
  'no-volatile-default': noVolatileDefault,
  'possible-rename-data-loss': possibleRenameDataLoss,
  'require-concurrent-index': requireConcurrentIndex,
  'require-concurrent-index-drop': requireConcurrentIndexDrop,
  'require-concurrent-unique': requireConcurrentUnique,
  'require-down': requireDown,
  'require-lock-timeout': requireLockTimeout,
  'require-not-valid-check': requireNotValidCheck,
  'require-not-valid-foreign-key': requireNotValidForeignKey,
  'typeorm/invalid-migration-name': typeormInvalidMigrationName,
  'typeorm/no-changecolumn-recreate': typeormNoChangecolumnRecreate,
  'typeorm/no-enum-recreate': typeormNoEnumRecreate,
  'typeorm/transaction-override-forbidden': typeormTransactionOverrideForbidden,
  'unanalyzable-statement': unanalyzableStatement,
}
