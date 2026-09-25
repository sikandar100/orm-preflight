import { column, docsUrl, opsOf } from '../../../rules/helpers.js'
import type { Rule } from '../../../rules/types.js'

export const noChangecolumnRecreate: Rule = {
  meta: {
    id: 'typeorm/no-changecolumn-recreate',
    category: 'data-loss',
    defaultSeverity: 'error',
    dialects: ['postgres', 'mysql'],
    adapter: 'typeorm',
    docsUrl: docsUrl('typeorm/no-changecolumn-recreate'),
  },
  check(migration, ctx) {
    return opsOf(migration.up, 'typeorm.change_column')
      .filter((op) => op.recreates !== 'no')
      .map((op) => ({
        op,
        target: { table: op.table, column: op.column },
        // TypeORM compares against the column read from the database when only a name is
        // given, so the recreate cannot be confirmed statically.
        downgrade: op.recreates === 'unknown',
        message:
          op.recreates === 'yes'
            ? `changeColumn drops and re-adds ${column(op.table, op.column, ctx)} because its type, length, or array flag changes. Every existing value in the column is lost.`
            : `changeColumn gets ${column(op.table, op.column, ctx)} as the old column, so orm-preflight cannot compare it. If its type, length, or array flag changes, TypeORM drops and re-adds the column and every existing value is lost.`,
        why: 'TypeORM\'s changeColumn does not alter a column in place when its type, length, or array flag changes. It drops the column and adds it again ("To avoid data conversion, we just recreate column").',
        safeAlternative:
          'For a longer varchar or varchar to text, run ALTER TABLE ... ALTER COLUMN ... TYPE with queryRunner.query(). For other changes, expand and contract: add a new column, backfill it, switch the code, and drop the old column in a later release.',
      }))
  },
}
