import type { Rule } from '../../../rules/types.js'
import { invalidMigrationName } from './invalid-migration-name.js'
import { noChangecolumnRecreate } from './no-changecolumn-recreate.js'
import { transactionOverrideForbidden } from './transaction-override-forbidden.js'

/** TypeORM adapter rules. Rule IDs are public API. */
export const typeormRules: readonly Rule[] = [
  noChangecolumnRecreate,
  transactionOverrideForbidden,
  invalidMigrationName,
]
