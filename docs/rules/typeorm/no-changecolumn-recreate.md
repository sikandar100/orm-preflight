# typeorm/no-changecolumn-recreate

Reports `queryRunner.changeColumn()` calls that make TypeORM drop and re-add the column, which deletes every value in it.

| Category  | Default severity | Databases         |
| --------- | ---------------- | ----------------- |
| data-loss | error            | PostgreSQL, MySQL |

## What happens

`changeColumn()` does not always alter a column in place. When the change needs a conversion,
TypeORM drops the column and adds it again ("To avoid data conversion, we just recreate column"),
and every existing value is lost.

- **PostgreSQL:** when the type, length, or array flag changes, when the column becomes a stored
  generated column, or when the expression of a stored generated column changes.
- **MySQL:** when the type or length changes, when the generated type changes, or when generation is
  turned on or off (except for `uuid`).

orm-preflight compares the old and new `TableColumn`. When the old column is passed by name, as a
string, it cannot compare them, and reports a warning instead of an error.

A `changeColumn()` that only renames is reported by `no-rename-column`, and one that sets
`isNullable: false` by `no-set-not-null`.

## Bad

```ts
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class WidenUserName1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'users',
      new TableColumn({ name: 'name', type: 'varchar', length: '100' }),
      new TableColumn({ name: 'name', type: 'varchar', length: '255' }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Write the change as SQL, which alters the column in place:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class WidenUserName1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "name" TYPE character varying(255)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

A longer `varchar`, or `varchar` to `text`, keeps the data and does not rewrite the table on
PostgreSQL. For other type changes, use expand and contract: add a new column, backfill it, switch
the code, and drop the old column in a later release.

## When to suppress

When losing the column's data is intended, or the table is known to be empty in every environment.

```ts
// preflight safety-assured typeorm/no-changecolumn-recreate -- column holds derived data, recomputed by the job
```

## References

- TypeORM 1.x: [`PostgresQueryRunner.changeColumn`](https://github.com/typeorm/typeorm/blob/f279fd1367f24ad108a1b11cf833f1620274088d/packages/typeorm/src/driver/postgres/PostgresQueryRunner.ts#L1306),
  [`MysqlQueryRunner.changeColumn`](https://github.com/typeorm/typeorm/blob/f279fd1367f24ad108a1b11cf833f1620274088d/packages/typeorm/src/driver/mysql/MysqlQueryRunner.ts#L1117)
- TypeORM 0.3.x: [`PostgresQueryRunner.changeColumn`](https://github.com/typeorm/typeorm/blob/797320375fb83b2e9af4a6455e0b1b4483be329d/src/driver/postgres/PostgresQueryRunner.ts#L1211),
  [`MysqlQueryRunner.changeColumn`](https://github.com/typeorm/typeorm/blob/797320375fb83b2e9af4a6455e0b1b4483be329d/src/driver/mysql/MysqlQueryRunner.ts#L1030)
- TypeORM issue [#3357](https://github.com/typeorm/typeorm/issues/3357)
- PostgreSQL: [ALTER TABLE, SET DATA TYPE](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-DESC-SET-DATA-TYPE)
- MySQL: [ALTER TABLE, renaming, redefining, and reordering columns](https://dev.mysql.com/doc/refman/8.4/en/alter-table.html#alter-table-redefine-column)
