import { invalidSuppression } from './invalid-suppression.js'
import { noDropAndRecreateColumn } from './no-drop-and-recreate-column.js'
import { noDropColumn } from './no-drop-column.js'
import { noDropTable } from './no-drop-table.js'
import { noRenameColumn } from './no-rename-column.js'
import { noRenameTable } from './no-rename-table.js'
import { noTruncate } from './no-truncate.js'
import { possibleRenameDataLoss } from './possible-rename-data-loss.js'
import type { Rule } from './types.js'
import { unanalyzableStatement } from './unanalyzable-statement.js'

/** Core rules. Rule IDs are public API. */
export const coreRules: readonly Rule[] = [
  noDropAndRecreateColumn,
  possibleRenameDataLoss,
  noDropColumn,
  noDropTable,
  noTruncate,
  noRenameColumn,
  noRenameTable,
  unanalyzableStatement,
  invalidSuppression,
]
