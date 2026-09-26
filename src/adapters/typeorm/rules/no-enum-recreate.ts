import type { Operation } from '../../../ir/types.js'
import { docsUrl, opsOf, table, tableKey } from '../../../rules/helpers.js'
import type { Rule, RuleFinding } from '../../../rules/types.js'

/** The type name without its schema and quotes, for comparing names written differently. */
const bare = (name: string): string =>
  (name.split('.').at(-1) ?? name).replaceAll('"', '').toLowerCase()

export const noEnumRecreate: Rule = {
  meta: {
    id: 'typeorm/no-enum-recreate',
    category: 'locking',
    defaultSeverity: 'warn',
    dialects: ['postgres'],
    adapter: 'typeorm',
    docsUrl: docsUrl('typeorm/no-enum-recreate'),
  },
  check(migration, ctx) {
    const up = migration.up
    const created = new Set(opsOf(up, 'create_table').map((op) => tableKey(op.table)))
    const findings: RuleFinding[] = []
    for (const rename of opsOf(up, 'enum_rename')) {
      // TypeORM 0.3: RENAME TO <name>_old, CREATE TYPE <name>, ALTER COLUMN ... TYPE <name>
      // USING ..., DROP TYPE <name>_old.
      const name = bare(rename.from)
      if (bare(rename.to) !== `${name}_old`) continue
      const after = up.slice(up.indexOf(rename) + 1)
      if (!after.some((op) => op.kind === 'enum_create' && bare(op.name) === name)) continue
      const converted = after.filter(
        (op): op is Extract<Operation, { kind: 'alter_column_type' }> =>
          op.kind === 'alter_column_type' && bare(op.to) === name,
      )
      // Columns on tables created in this migration have no rows to convert.
      const existing = converted.filter((op) => !created.has(tableKey(op.table)))
      const [first] = existing
      if (first === undefined) continue
      const columns = existing.map((op) => `${table(op.table, ctx)}."${op.column}"`).join(', ')
      findings.push({
        op: rename,
        target: { table: first.table },
        message: `TypeORM recreates enum "${rename.from}" instead of adding values to it. Converting ${columns} to the new type rewrites ${existing.length === 1 ? 'the table' : 'each table'} while blocking reads and writes, and fails if a row holds a value that was removed.`,
        why: 'TypeORM 0.3 changes an enum in four steps: rename the old type to _old, create the new type, convert each column with ALTER COLUMN ... TYPE ... USING, and drop the old type. Each conversion rewrites its table under an ACCESS EXCLUSIVE lock. TypeORM 1.x uses ALTER TYPE ... ADD VALUE when values are only added.',
        safeAlternative:
          'When you only add values, replace the generated statements with ALTER TYPE ... ADD VALUE, which changes no rows. To rename a value, use ALTER TYPE ... RENAME VALUE. To remove values, use expand and contract: add a column with the new type, backfill it, switch the code, and drop the old column later.',
      })
    }
    return findings
  },
}
