import { column, docsUrl, opsOf, table, tableKey } from './helpers.js'
import type { Rule, RuleFinding } from './types.js'

export const noDropAndRecreateColumn: Rule = {
  meta: {
    id: 'no-drop-and-recreate-column',
    category: 'data-loss',
    defaultSeverity: 'error',
    dialects: ['postgres', 'mysql'],
    supersedes: ['no-drop-column'],
    docsUrl: docsUrl('no-drop-and-recreate-column'),
  },
  check(migration, ctx) {
    const findings: RuleFinding[] = []
    migration.up.forEach((op, i) => {
      if (op.kind !== 'drop_column') return
      const readded = opsOf(migration.up.slice(i + 1), 'add_column').find(
        (add) => tableKey(add.table) === tableKey(op.table) && add.column === op.column,
      )
      // A stored generated column is computed from other columns, so no data is lost.
      // Its table rewrite is a locking concern, reported by no-volatile-default.
      if (readded === undefined || readded.generated === 'stored') return
      const alter = `ALTER TABLE ${table(op.table, ctx)} ALTER COLUMN "${op.column}" TYPE ${readded.type ?? '<new type>'}`
      findings.push({
        op,
        target: { table: op.table, column: op.column },
        message: `${column(op.table, op.column, ctx)} is dropped and re-added in the same migration. Every existing value in this column will be lost.`,
        why: 'TypeORM drops and re-adds a column when its type or length changes, instead of changing it in place. The new column starts empty.',
        safeAlternative: `Change the type in place: ${alter}. Widening a varchar, or changing varchar to text, does not rewrite the table. For other type changes, add a new column, backfill it, switch the code, and drop the old column in a later release.`,
      })
    })
    return findings
  },
}
