# rewrites-existing-rows

Lists every statement that changes existing data, such as an `UPDATE` backfill, so a review can check it.

| Category  | Default severity | Databases         |
| --------- | ---------------- | ----------------- |
| data-loss | info             | PostgreSQL, MySQL |

## What happens

Schema changes are easy to review: the migration shows them. Data changes are not, because the
migration does not show which rows match or what they held before. When a release must not lose
data, every data change deserves a look. This rule lists them, as `info`, so they never fail a
run:

- an `UPDATE`, with its table and, on PostgreSQL, its `WHERE` condition
- an `UPDATE` without `WHERE`, which rewrites every row in one statement
- a `MERGE`, and an `INSERT ... ON CONFLICT DO UPDATE`, which may overwrite rows
- an `INSERT ... SELECT`, whose rows depend on the data at deploy time

A `DELETE` is reported by [no-delete-rows](no-delete-rows.md), and an `UPDATE` that only clears
columns by [no-null-out-column](no-null-out-column.md). When an `UPDATE` clears columns while it
changes others, this rule names the cleared columns. A table created in the same migration is not
reported.

**A whole-table backfill in one statement** also has a cost. On PostgreSQL, an `UPDATE` locks
every row it changes until the transaction ends, so writes to those rows wait. It also writes a
new version of each row, and the old versions stay until VACUUM removes them. On a large table,
update in batches instead, outside the migration's transaction.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class BackfillFullName1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "users" SET "full_name" = "first_name" || ' ' || "last_name"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

There is nothing to fix when the change is intended: the finding is for the review. Check which
rows change, and whether `down()` needs to restore the old values. For a large table, backfill in
batches in a migration that runs outside a transaction:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class BackfillFullName1727200000000 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Each call is its own transaction, so locks are held for one batch at a time.
    // preflight safety-assured rewrites-existing-rows -- batched backfill of a new column
    await queryRunner.query(
      `UPDATE "users" SET "full_name" = "first_name" || ' ' || "last_name" WHERE "id" < 100000 AND "full_name" IS NULL`,
    )
    // ... further batches
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

```json
{ "typeorm": { "transactionMode": "each" } }
```

## When to suppress

When the data change has been reviewed, to keep the list short. Write what was checked:

```ts
// preflight safety-assured rewrites-existing-rows -- fixes the "actve" typo, 14 rows on production
```

## References

- PostgreSQL: [UPDATE](https://www.postgresql.org/docs/current/sql-update.html)
- PostgreSQL: [explicit locking, row-level locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS)
  ("The FOR UPDATE lock mode is also acquired by any DELETE on a row, and also by an UPDATE that
  modifies the values of certain columns", and other transactions that write these rows "will be
  blocked until the current transaction ends")
- PostgreSQL: [routine vacuuming, recovering disk space](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY)
  ("In PostgreSQL, an UPDATE or DELETE of a row does not immediately remove the old version of the
  row.")
- MySQL: [UPDATE statement](https://dev.mysql.com/doc/refman/8.4/en/update.html)
