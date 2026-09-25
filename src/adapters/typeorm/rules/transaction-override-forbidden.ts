import { docsUrl } from '../../../rules/helpers.js'
import type { Rule } from '../../../rules/types.js'
import { resolveTransactionMode } from '../transaction.js'

export const transactionOverrideForbidden: Rule = {
  meta: {
    id: 'typeorm/transaction-override-forbidden',
    category: 'correctness',
    defaultSeverity: 'error',
    dialects: ['postgres', 'mysql'],
    adapter: 'typeorm',
    docsUrl: docsUrl('typeorm/transaction-override-forbidden'),
  },
  check(migration, ctx) {
    const declared = migration.adapterData?.declaredTransaction
    if (declared === undefined || resolveTransactionMode(ctx.adapterOptions) !== 'all') return []
    const setting =
      typeof declared === 'boolean' ? `sets transaction = ${String(declared)}` : 'sets transaction'
    return [
      {
        loc: migration.loc,
        message: `This migration ${setting}, but migrations run with migrationsTransactionMode "all". TypeORM throws ForbiddenTransactionModeOverrideError and no pending migration runs.`,
        why: 'In transaction mode "all", TypeORM wraps every pending migration in one transaction and refuses to start when any of them sets its own transaction property, true or false.',
        safeAlternative:
          'Set migrationsTransactionMode: "each" in the DataSource and "typeorm": { "transactionMode": "each" } in the orm-preflight config. Or remove the transaction property from the migration.',
      },
    ]
  },
}
