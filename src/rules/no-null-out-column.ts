import { column, docsUrl, opsOf } from './helpers.js'
import type { Rule, RuleFinding } from './types.js'

export const noNullOutColumn: Rule = {
  meta: {
    id: 'no-null-out-column',
    category: 'data-loss',
    defaultSeverity: 'warn',
    dialects: ['postgres', 'mysql'],
    docsUrl: docsUrl('no-null-out-column'),
  },
  check(migration, ctx) {
    // Only an UPDATE that just clears columns. When it also changes other columns, the NULLs
    // are a side effect, such as resetting updated_by, and rewrites-existing-rows lists it.
    return opsOf(migration.up, 'data_change').flatMap((op): RuleFinding[] =>
      (op.onlyNulls === true ? (op.nulls ?? []) : []).map((name) => {
        const where =
          op.rows === 'all'
            ? 'in every row'
            : op.where !== undefined
              ? `in rows where ${op.where}`
              : 'in the rows that match the WHERE'
        return {
          op,
          target: { table: op.table, column: name },
          message: `${column(op.table, name, ctx)} is set to NULL ${where}, which deletes the values it held.`,
          why: 'Setting a column to NULL overwrites its values for good. down() cannot bring them back unless the migration saved a copy first.',
          safeAlternative:
            'Check which values are cleared, and keep a copy, such as in a backup table, if they might be needed. If clearing them is intended, suppress this finding with the reason.',
        }
      }),
    )
  },
}
