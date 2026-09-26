# require-not-valid-check

Reports a CHECK constraint added to an existing table without `NOT VALID`, which checks every row while blocking reads and writes.

| Category | Default severity | Databases  |
| -------- | ---------------- | ---------- |
| locking  | warn             | PostgreSQL |

It becomes an error by default in 1.0.

## What happens

Adding a CHECK constraint makes PostgreSQL scan the whole table to prove that every existing row
satisfies it. The scan runs under an ACCESS EXCLUSIVE lock, which blocks every read and write on
the table until it finishes.

With `NOT VALID`, the constraint is added without the scan and applies to new and changed rows
right away. `VALIDATE CONSTRAINT` then checks the existing rows under a SHARE UPDATE EXCLUSIVE
lock, which does not block reads or writes.

Statements on a table created in the same migration are not reported: the table has no rows yet.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserAgeCheck1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "CHK_users_age" CHECK ("age" >= 0)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Add the constraint with `NOT VALID`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserAgeCheck1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_age" CHECK ("age" >= 0) NOT VALID`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

Then validate it in a separate, later migration:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class ValidateUserAgeCheck1727300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" VALIDATE CONSTRAINT "CHK_users_age"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

TypeORM's `createCheckConstraint()` cannot add `NOT VALID`, so use `queryRunner.query()`.

## When to suppress

When the table is small, or the migration runs in a maintenance window.

```ts
// preflight safety-assured require-not-valid-check -- plans has 12 rows
```

## References

- PostgreSQL: [ALTER TABLE, ADD table_constraint](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-DESC-ADD-TABLE-CONSTRAINT)
  ("Normally, this form will cause a scan of the table to verify that all existing rows in the
  table satisfy the new constraint. But if the NOT VALID option is used, this
  potentially-lengthy scan is skipped.")
- PostgreSQL: [ALTER TABLE, notes](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-NOTES) ("validation
  acquires only a SHARE UPDATE EXCLUSIVE lock on the table being altered")
- orm-preflight [lock verification results](../../test/verify/README.md)
