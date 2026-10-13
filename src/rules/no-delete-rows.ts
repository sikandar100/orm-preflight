import { docsUrl, opsOf, table } from './helpers.js'
import type { Rule } from './types.js'

export const noDeleteRows: Rule = {
  meta: {
    id: 'no-delete-rows',
    category: 'data-loss',
    defaultSeverity: 'warn',
    dialects: ['postgres', 'mysql'],
    docsUrl: docsUrl('no-delete-rows'),
  },
  check(migration, ctx) {
    return opsOf(migration.up, 'data_change')
      .filter((op) => op.statement === 'delete')
      .map((op) => {
        const t = table(op.table, ctx)
        const which =
          op.rows === 'all'
            ? `Every row of ${t} is deleted.`
            : op.where !== undefined
              ? `Rows of ${t} where ${op.where} are deleted.`
              : `Rows of ${t} that match the WHERE are deleted.`
        return {
          op,
          target: { table: op.table },
          message: `${which} They are gone once the migration commits.`,
          why: 'DELETE removes rows for good. down() cannot bring them back unless the migration saved a copy first, and a data loss in a migration is easy to miss in review.',
          safeAlternative:
            'Check which rows go, for example by counting them first, and keep a copy, such as in a backup table, if they might be needed. If removing them is intended, suppress this finding with the reason.',
        }
      })
  },
}
