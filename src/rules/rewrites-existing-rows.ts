import type { Operation } from '../ir/types.js'
import { docsUrl, opsOf, table } from './helpers.js'
import type { Rule, RuleContext, RuleFinding } from './types.js'

type DataChange = Operation & { kind: 'data_change' }

export const rewritesExistingRows: Rule = {
  meta: {
    id: 'rewrites-existing-rows',
    category: 'data-loss',
    defaultSeverity: 'info',
    dialects: ['postgres', 'mysql'],
    docsUrl: docsUrl('rewrites-existing-rows'),
  },
  check(migration, ctx) {
    return opsOf(migration.up, 'data_change').flatMap((op): RuleFinding[] => {
      // Deletes, and updates that only clear columns, have rules of their own.
      if (op.statement === 'delete' || op.onlyNulls === true) return []
      const found = describe(op, ctx)
      if (found === undefined) return []
      const cleared = (op.nulls ?? []).map((c) => `"${c}"`).join(', ')
      return [
        {
          op,
          target: { table: op.table },
          ...found,
          message:
            cleared === '' ? found.message : `${found.message} It also sets ${cleared} to NULL.`,
        },
      ]
    })
  },
}

const REVIEW =
  'Check that the change is intended, and whether down() needs to restore the old values.'

function describe(
  op: DataChange,
  ctx: RuleContext,
): Pick<RuleFinding, 'message' | 'why' | 'safeAlternative'> | undefined {
  const t = table(op.table, ctx)
  switch (op.statement) {
    case 'update':
      if (op.rows === 'all') {
        return {
          message: `This UPDATE rewrites every row of ${t}, in one statement.`,
          why: 'A whole-table UPDATE locks every row it changes until the migration commits, so writes to those rows wait, and it writes a new version of each row. On a large table that takes long and leaves the table bloated until VACUUM.',
          safeAlternative: `${REVIEW} On a large table, update in batches, for example by ranges of the primary key, outside the migration's transaction.`,
        }
      }
      return {
        message:
          op.where === undefined
            ? `This UPDATE rewrites the rows of ${t} that match its WHERE.`
            : `This UPDATE rewrites the rows of ${t} where ${op.where}.`,
        why: 'Data changed in a migration is easy to miss in review, and the old values are gone once it commits.',
        safeAlternative: REVIEW,
      }
    case 'merge':
      return {
        message: `This MERGE may rewrite existing rows of ${t}.`,
        why: 'Data changed in a migration is easy to miss in review, and the old values are gone once it commits.',
        safeAlternative: REVIEW,
      }
    case 'insert':
      if (op.from === 'upsert') {
        return {
          message: `This INSERT ... ON CONFLICT DO UPDATE may overwrite existing rows of ${t}.`,
          why: 'When a row already exists, its values are replaced. The old values are gone once the migration commits.',
          safeAlternative: REVIEW,
        }
      }
      if (op.from === 'select') {
        return {
          message: `This INSERT ... SELECT writes rows into ${t} from a query.`,
          why: 'Rows copied by a query depend on the data at deploy time, which a review of the migration does not show.',
          safeAlternative:
            'Check which rows the query returns on real data, and that running the migration again or reverting it leaves no duplicates.',
        }
      }
      return undefined
    default:
      return undefined
  }
}
