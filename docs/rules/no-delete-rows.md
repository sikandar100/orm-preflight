# no-delete-rows

Reports a `DELETE` on an existing table, which removes rows for good.

| Category  | Default severity | Databases         |
| --------- | ---------------- | ----------------- |
| data-loss | warn             | PostgreSQL, MySQL |

## What happens

A `DELETE` in a migration removes rows once the migration commits. `down()` cannot bring them
back unless the migration saved a copy first. Data cleanup in a migration is easy to miss in
review, because the migration file does not show which rows match.

The finding names the table and, on PostgreSQL, the `WHERE` condition. A `DELETE` without `WHERE`
removes every row. A table created in the same migration is not reported: it has no rows to lose.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class RemoveInactiveUsers1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "users" WHERE "inactive" = true`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Keep a copy first, so `down()` can restore the rows:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class RemoveInactiveUsers1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users_removed_1727200000000" AS SELECT * FROM "users" WHERE "inactive" = true`,
    )
    // preflight safety-assured no-delete-rows -- a copy is kept in users_removed_1727200000000
    await queryRunner.query(`DELETE FROM "users" WHERE "inactive" = true`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`INSERT INTO "users" SELECT * FROM "users_removed_1727200000000"`)
    await queryRunner.query(`DROP TABLE "users_removed_1727200000000"`)
  }
}
```

Before deploying, count the rows on real data, so you know what goes.

## When to suppress

When removing the rows is the point, for example clearing expired sessions, and nothing needs them
back. Write that reason:

```ts
// preflight safety-assured no-delete-rows -- expired sessions, nothing reads them
```

## References

- PostgreSQL: [DELETE](https://www.postgresql.org/docs/current/sql-delete.html) ("DELETE deletes
  rows that satisfy the WHERE clause from the specified table. If the WHERE clause is absent, the
  effect is to delete all rows in the table.")
- MySQL: [DELETE statement](https://dev.mysql.com/doc/refman/8.4/en/delete.html)
