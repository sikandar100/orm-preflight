# no-set-not-null

Reports `SET NOT NULL` on an existing column, which scans the whole table while blocking reads and writes.

| Category | Default severity | Databases  |
| -------- | ---------------- | ---------- |
| locking  | error            | PostgreSQL |

## What happens

`ALTER COLUMN ... SET NOT NULL` holds an ACCESS EXCLUSIVE lock, which blocks every read and write,
and scans every row to make sure none is NULL. On a large table the block lasts as long as the
scan.

PostgreSQL skips the scan when a validated `CHECK` constraint already proves the column has no
NULLs. PostgreSQL 18 can also add a NOT NULL constraint as `NOT VALID` and validate it later. The
safe pattern depends on your version, so set `postgresVersion` in the config (default 16).

In TypeORM this comes from changing `nullable: true` to `false`, in a generated migration or in
`changeColumn()`. The rule is not reported when the same migration validates a constraint on the
table first, or drops a constraint on it afterwards, which is the safe pattern below.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class RequireUserEmail1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe on PostgreSQL 12 to 17

First migration: add a CHECK constraint without checking existing rows.

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class CheckUserEmail1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "users_email_not_null" CHECK ("email" IS NOT NULL) NOT VALID`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

Second migration, after NULLs are backfilled: validate it without blocking writes, set NOT NULL
(no scan, because the CHECK proves it), and drop the CHECK.

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class RequireUserEmail1727300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" VALIDATE CONSTRAINT "users_email_not_null"`)
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "users_email_not_null"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe on PostgreSQL 18

Add the NOT NULL constraint without checking rows, then validate it in a later migration.
Validation takes only a SHARE UPDATE EXCLUSIVE lock.

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class RequireUserEmail1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "users_email_not_null" NOT NULL "email" NOT VALID`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class ValidateUserEmail1727300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" VALIDATE CONSTRAINT "users_email_not_null"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

Before PostgreSQL 12 there is no way to avoid the scan: run the change in a maintenance window.

## When to suppress

When the table is small, or the migration runs in a maintenance window.

```ts
// preflight safety-assured no-set-not-null -- settings table has one row per tenant, under 500 rows
```

## References

- PostgreSQL: [ALTER TABLE, SET / DROP NOT NULL](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-DESC-SET-DROP-NOT-NULL)
  ("Ordinarily this is checked during the ALTER TABLE by scanning the entire table, unless NOT
  VALID is specified; however, if a valid CHECK constraint exists ... which proves no NULL can
  exist, then the table scan is skipped.")
- PostgreSQL: [ALTER TABLE, ADD table_constraint](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-DESC-ADD-TABLE-CONSTRAINT)
  (NOT VALID "is currently only allowed for foreign-key, CHECK, and not-null constraints", on 18)
- orm-preflight [lock verification results](../../test/verify/README.md)
