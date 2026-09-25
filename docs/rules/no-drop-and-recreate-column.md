# no-drop-and-recreate-column

Reports a column that is dropped and added again in the same migration, which deletes every value in it.

| Category  | Default severity | Databases         |
| --------- | ---------------- | ----------------- |
| data-loss | error            | PostgreSQL, MySQL |

This rule supersedes `no-drop-column`: when both apply to the same column, only this one is reported.

## What happens

When a column's type, length, or array flag changes, TypeORM does not alter the column in place.
Its `changeColumn` drops the column and adds it again, with the comment "To avoid data conversion,
we just recreate column". `typeorm migration:generate` goes through the same code, so a generated
migration for a longer `varchar` contains `DROP COLUMN` followed by `ADD`.

The new column starts empty: every row gets NULL, or the default. The old values are gone as soon
as the migration commits. If the new column is `NOT NULL` without a default, the migration fails on
any table with rows, and `no-add-not-null-without-default` reports that too.

A stored generated column that is dropped and added again is not reported, because PostgreSQL
computes its values again.

## Bad

This is what `migration:generate` writes after `@Column({ length: 100 })` becomes
`@Column({ length: 255 })`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class WidenUserName1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "name"`)
    await queryRunner.query(`ALTER TABLE "users" ADD "name" character varying(255) NOT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Replace the generated pair with an in-place change. Making a `varchar` longer, or changing it to
`text`, keeps the data and does not rewrite the table on PostgreSQL:

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

For type changes that do rewrite or convert data, use expand and contract: add a new column,
backfill it, switch the code to it, and drop the old column in a later release.

## When to suppress

When losing the column's data is intended, or the table is known to be empty in every environment.

```ts
// preflight safety-assured no-drop-and-recreate-column -- column only holds cache data, rebuilt on start
```

## References

- PostgreSQL: [ALTER TABLE, SET DATA TYPE](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-DESC-SET-DATA-TYPE)
  (a binary-coercible change needs no rewrite)
- MySQL: [ALTER TABLE, renaming, redefining, and reordering columns](https://dev.mysql.com/doc/refman/8.4/en/alter-table.html#alter-table-redefine-column)
- TypeORM 1.x: [`PostgresQueryRunner.changeColumn`](https://github.com/typeorm/typeorm/blob/f279fd1367f24ad108a1b11cf833f1620274088d/packages/typeorm/src/driver/postgres/PostgresQueryRunner.ts#L1338),
  [`MysqlQueryRunner.changeColumn`](https://github.com/typeorm/typeorm/blob/f279fd1367f24ad108a1b11cf833f1620274088d/packages/typeorm/src/driver/mysql/MysqlQueryRunner.ts#L1117)
- TypeORM 0.3.x: [`PostgresQueryRunner.changeColumn`](https://github.com/typeorm/typeorm/blob/797320375fb83b2e9af4a6455e0b1b4483be329d/src/driver/postgres/PostgresQueryRunner.ts#L1243),
  [`MysqlQueryRunner.changeColumn`](https://github.com/typeorm/typeorm/blob/797320375fb83b2e9af4a6455e0b1b4483be329d/src/driver/mysql/MysqlQueryRunner.ts#L1030)
- TypeORM issue [#3357](https://github.com/typeorm/typeorm/issues/3357): "Migration generation drops
  and creates columns instead of altering resulting in data loss"
