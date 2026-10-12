import { column, docsUrl, opsOf } from './helpers.js'
import type { Rule } from './types.js'

export const noTruncatingTypeChange: Rule = {
  meta: {
    id: 'no-truncating-type-change',
    category: 'data-loss',
    defaultSeverity: 'warn',
    dialects: ['postgres'],
    docsUrl: docsUrl('no-truncating-type-change'),
  },
  check(migration, ctx) {
    return opsOf(migration.up, 'alter_column_type').flatMap((op) =>
      op.truncates === undefined
        ? []
        : [
            {
              op,
              target: { table: op.table, column: op.column },
              message: `${column(op.table, op.column, ctx)} is converted to ${op.to} with ${op.truncates} in USING, which can keep only part of each value. Whatever it drops is lost.`,
              why: 'A USING expression replaces every value with its result. Functions such as left(), substring(), and round(), and an explicit cast to varchar(n), drop part of a value without any error, and the original cannot be recovered. Without USING, PostgreSQL fails on a value that does not fit instead of cutting it.',
              safeAlternative:
                'Check first that no value would be cut, for example with a SELECT that counts the rows where the expression changes the value. To keep the data, add a new column with the new type, copy the values, switch the code, and drop the old column in a later release. If cutting the values is intended, suppress this finding with that reason.',
            },
          ],
    )
  },
}
