# validate-in-same-transaction

Reports `VALIDATE CONSTRAINT` in the same transaction that added the constraint with `NOT VALID`, where it gains nothing.

| Category | Default severity | Databases  |
| -------- | ---------------- | ---------- |
| locking  | warn             | PostgreSQL |

## What happens

Adding a CHECK or foreign key with `NOT VALID` skips the scan of existing rows. `VALIDATE
CONSTRAINT` checks them later, under a weaker lock that does not block reads or writes. That is
the safe way to add a constraint to a busy table.

But a lock lasts until the end of the transaction that took it. When both statements run in one
transaction, `VALIDATE` reads the whole table while the strong lock from adding the constraint is
still held:

- for a CHECK, ACCESS EXCLUSIVE, which blocks reads and writes
- for a foreign key, SHARE ROW EXCLUSIVE on both tables, which blocks writes

That is the same as adding the constraint without `NOT VALID`.

TypeORM runs migrations in a transaction by default. With `migrationsTransactionMode: "all"`, the
default, **every pending migration runs in one transaction**, so even a `VALIDATE` in a separate
migration gains nothing when both migrations are deployed together. This rule sees one migration
at a time, so it reports only the case inside one migration.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserAgeCheck1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_age" CHECK ("age" >= 0) NOT VALID`,
    )
    await queryRunner.query(`ALTER TABLE "users" VALIDATE CONSTRAINT "CHK_users_age"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Validate in a migration of its own, deployed in a later release, after the one that added the
constraint has run:

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

## Safe

Or, to do both in one release, run the migration without a transaction. Each `query()` call then
commits on its own, so the strong lock is released before `VALIDATE` starts:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserAgeCheck1727200000000 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_age" CHECK ("age" >= 0) NOT VALID`,
    )
    await queryRunner.query(`ALTER TABLE "users" VALIDATE CONSTRAINT "CHK_users_age"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

This needs `migrationsTransactionMode: "each"` in the DataSource, and the same in
`orm-preflight.config.json`:

```json
{ "typeorm": { "transactionMode": "each" } }
```

## When to suppress

When the table is small enough that a full read under the lock is fine, and you want the
constraint added and validated in one step.

```ts
// preflight safety-assured validate-in-same-transaction -- plans has 12 rows
```

## References

- PostgreSQL: [explicit locking, table-level locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-TABLES)
  ("Once acquired, a lock is normally held until the end of the transaction.")
- PostgreSQL: [ALTER TABLE, notes](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-NOTES)
  ("validation acquires only a SHARE UPDATE EXCLUSIVE lock on the table being altered")
- TypeORM 0.3.x: [`MigrationExecutor.executePendingMigrations`](https://github.com/typeorm/typeorm/blob/797320375fb83b2e9af4a6455e0b1b4483be329d/src/migration/MigrationExecutor.ts#L323)
  starts one transaction before it runs all pending migrations, when the mode is `"all"`
- orm-preflight [lock verification results](https://github.com/sikandar100/orm-preflight/blob/main/test/verify/README.md)
  ("check NOT VALID + VALIDATE, 1 tx" and "fk NOT VALID + VALIDATE, 1 tx")
