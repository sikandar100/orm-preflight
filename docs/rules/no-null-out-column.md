# no-null-out-column

Reports an `UPDATE` that only clears columns, setting them to `NULL` on an existing table, which deletes the values they held.

| Category  | Default severity | Databases         |
| --------- | ---------------- | ----------------- |
| data-loss | warn             | PostgreSQL, MySQL |

## What happens

`UPDATE ... SET "column" = NULL` overwrites the column's values once the migration commits.
`down()` cannot bring them back unless the migration saved a copy first. The finding names the
column and, on PostgreSQL, the `WHERE` condition, or says that every row is changed.

An `UPDATE` that also changes other columns is not reported here, because a cleared column there
is usually a side effect, such as resetting `updated_by`. [rewrites-existing-rows](rewrites-existing-rows.md)
lists that statement instead, and names the columns it clears.

A table created in the same migration is not reported: it has no values to lose.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class ClearUkPhones1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "users" SET "phone" = NULL WHERE "country" = 'UK'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Keep a copy of the values first, so `down()` can restore them:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class ClearUkPhones1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users_phone_1727200000000" AS SELECT "id", "phone" FROM "users" WHERE "country" = 'UK'`,
    )
    // preflight safety-assured no-null-out-column -- a copy is kept in users_phone_1727200000000
    await queryRunner.query(`UPDATE "users" SET "phone" = NULL WHERE "country" = 'UK'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "users" u SET "phone" = c."phone" FROM "users_phone_1727200000000" c WHERE u."id" = c."id"`,
    )
    await queryRunner.query(`DROP TABLE "users_phone_1727200000000"`)
  }
}
```

## When to suppress

When the values must go, for example personal data that may no longer be kept, and nothing needs
them back. Write that reason:

```ts
// preflight safety-assured no-null-out-column -- phone numbers may not be kept after account closure
```

## References

- PostgreSQL: [UPDATE](https://www.postgresql.org/docs/current/sql-update.html) ("UPDATE changes
  the values of the specified columns in all rows that satisfy the condition.")
- MySQL: [UPDATE statement](https://dev.mysql.com/doc/refman/8.4/en/update.html)
