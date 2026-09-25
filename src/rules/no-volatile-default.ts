import { column, docsUrl, opsOf, table } from './helpers.js'
import type { Rule } from './types.js'

/** The default the SQL mapper and the TypeORM builder give serial and increment columns. */
const SERIAL = 'nextval (serial)'

export const noVolatileDefault: Rule = {
  meta: {
    id: 'no-volatile-default',
    category: 'locking',
    defaultSeverity: 'error',
    dialects: ['postgres'],
    docsUrl: docsUrl('no-volatile-default'),
  },
  check(migration, ctx) {
    return opsOf(migration.up, 'add_column').flatMap((op) => {
      let what: string
      if (op.generated === 'identity') what = 'as an identity column'
      else if (op.generated === 'stored') what = 'as a stored generated column'
      else if (op.default?.expr === SERIAL) what = 'as a serial column'
      else if (op.default?.volatile === true) what = `with a volatile default (${op.default.expr})`
      else return []
      return [
        {
          op,
          target: { table: op.table, column: op.column },
          message: `${column(op.table, op.column, ctx)} is added ${what}, which rewrites the whole ${table(op.table, ctx)} table while blocking reads and writes.`,
          why: 'The new value must be computed for every existing row, so PostgreSQL rewrites the table under an ACCESS EXCLUSIVE lock. A constant default, or a stable one such as now(), does not need a rewrite.',
          safeAlternative:
            op.default?.expr === SERIAL
              ? 'Add the column as a plain integer, create a sequence, and set the default with ALTER COLUMN ... SET DEFAULT nextval(...), which applies only to new rows. Then backfill existing rows in batches.'
              : op.generated === undefined
                ? 'Add the column without a default. Set the default in a separate statement (ALTER COLUMN ... SET DEFAULT, which applies only to new rows), then backfill existing rows in batches.'
                : 'Add a plain nullable column, fill it in batches (for identity: attach a sequence as the default first), and switch the application to it. Avoid adding computed columns to large tables in place.',
        },
      ]
    })
  },
}
