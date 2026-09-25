import type { TableRef } from '../ir/types.js'
import { column, docsUrl, opsOf, tableKey } from './helpers.js'
import type { Rule, RuleFinding } from './types.js'

export const possibleRenameDataLoss: Rule = {
  meta: {
    id: 'possible-rename-data-loss',
    category: 'data-loss',
    defaultSeverity: 'warn',
    dialects: ['postgres', 'mysql'],
    docsUrl: docsUrl('possible-rename-data-loss'),
  },
  check(migration, ctx) {
    const up = migration.up
    const key = (t: TableRef, c: string) => JSON.stringify([tableKey(t), c])
    const drops = opsOf(up, 'drop_column')
    const adds = opsOf(up, 'add_column')
    // A column dropped and re-added is reported by no-drop-and-recreate-column instead.
    const dropped = new Set(drops.map((d) => key(d.table, d.column)))
    const added = new Set(adds.map((a) => key(a.table, a.column)))

    const findings: RuleFinding[] = []
    for (const table of new Set(drops.map((d) => tableKey(d.table)))) {
      const tableDrops = drops.filter(
        (d) => tableKey(d.table) === table && !added.has(key(d.table, d.column)),
      )
      const tableAdds = adds.filter(
        (a) => tableKey(a.table) === table && !dropped.has(key(a.table, a.column)),
      )
      // A rename looks like exactly one column going and one coming. Anything else is a
      // restructuring, and each drop is still reported by no-drop-column.
      const [drop] = tableDrops
      const [add] = tableAdds
      if (
        tableDrops.length !== 1 ||
        tableAdds.length !== 1 ||
        drop === undefined ||
        add === undefined
      )
        continue
      // An INSERT or UPDATE on the table between adding and dropping is most likely a backfill.
      const from = up.indexOf(add)
      const to = up.indexOf(drop)
      const backfilled =
        from < to &&
        up
          .slice(from + 1, to)
          .some(
            (op) =>
              op.kind === 'data_change' &&
              tableKey(op.table) === table &&
              op.statement !== 'delete',
          )
      if (backfilled) continue
      findings.push({
        op: drop,
        target: { table: drop.table, column: drop.column },
        message: `${column(drop.table, drop.column, ctx)} is dropped and ${column(add.table, add.column, ctx)} is added in the same migration. If this is a rename, every value in "${drop.column}" is lost.`,
        why: 'A renamed property can turn into a migration that drops the old column and adds a new one. The data is not copied, and no statement in the migration copies it. The dropped column type is not known here, so check whether the columns match.',
        safeAlternative:
          'Rename through expand and contract: add the new column, backfill it from the old one, switch the code, and drop the old column in a later release.',
      })
    }
    return findings
  },
}
