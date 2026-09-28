# enum-value-used-in-same-transaction

Reports a new enum value that is used in the same transaction that adds it, which PostgreSQL rejects.

| Category | Default severity | Databases  |
| -------- | ---------------- | ---------- |
| locking  | warn             | PostgreSQL |

It becomes an error by default in 1.0.

## What happens

Since PostgreSQL 12, `ALTER TYPE ... ADD VALUE` can run inside a transaction, but the new value
cannot be used until that transaction commits. Using it earlier fails:
`ERROR: unsafe use of new value "archived" of enum type order_status_enum`, and the migration
stops there.

TypeORM 1.x generates `ADD VALUE` when you add a value to an enum column. Setting the new value
as the column's default, or updating rows to it, in the same migration then fails, because the
migration runs in a transaction. Several statements in one `query()` call also share one
implicit transaction.

orm-preflight looks for the value's string literal, such as `'archived'`, in the statements that
follow in the same transaction. With `migrationsTransactionMode: "all"`, every pending migration
shares one transaction, so a later migration that uses the value fails too; orm-preflight checks
each migration on its own and does not report that case.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddArchivedStatus1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."order_status_enum" ADD VALUE 'archived'`)
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'archived'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Add the value in one migration:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddArchivedStatus1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."order_status_enum" ADD VALUE 'archived'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

and use it in a later one:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class DefaultArchivedStatus1727300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'archived'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

With `migrationsTransactionMode: "each"`, each migration commits before the next one starts. In
`orm-preflight.config.json`:

```json
{ "typeorm": { "transactionMode": "each" } }
```

## When to suppress

When the literal only looks like the value, for example the same text in an unrelated column.

```ts
// preflight safety-assured enum-value-used-in-same-transaction -- 'archived' here is a plain text column
```

## References

- PostgreSQL: [ALTER TYPE, notes](https://www.postgresql.org/docs/current/sql-altertype.html) ("If ALTER TYPE ... ADD VALUE (the
  form that adds a new value to an enum type) is executed inside a transaction block, the new
  value cannot be used until after the transaction has been committed.")
- PostgreSQL: [multiple statements in a simple query](https://www.postgresql.org/docs/current/protocol-flow.html#PROTOCOL-FLOW-MULTI-STATEMENT)
- orm-preflight [lock verification results](https://github.com/sikandar100/orm-preflight/blob/main/test/verify/README.md)
