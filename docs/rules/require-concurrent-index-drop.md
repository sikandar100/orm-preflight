# require-concurrent-index-drop

Reports `DROP INDEX` without `CONCURRENTLY`, which blocks reads and writes on the table while it waits and runs.

| Category | Default severity | Databases  |
| -------- | ---------------- | ---------- |
| locking  | warn             | PostgreSQL |

## What happens

A plain `DROP INDEX` takes an ACCESS EXCLUSIVE lock on the index's table. The drop itself is
quick, but the lock must first wait for every query already running on the table. While it
waits, every new query on the table, including plain reads, waits behind it. One slow query can
stop all traffic to the table.

`DROP INDEX CONCURRENTLY` waits for running queries without taking that lock, so reads and
writes continue. Like other concurrent index operations, it cannot run inside a transaction
(see `concurrent-index-transaction`).

An index created earlier in the same migration is not reported, since nothing uses it yet.

## Bad

What `migration:generate` writes when an `@Index()` is removed:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropUserEmailIndex1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_users_email"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropUserEmailIndex1727200000000 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX CONCURRENTLY "public"."IDX_users_email"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

With `migrationsTransactionMode: "each"` in the DataSource, and in `orm-preflight.config.json`:

```json
{ "typeorm": { "transactionMode": "each" } }
```

## When to suppress

When the table is small and quiet, or the migration runs in a maintenance window.

```ts
// preflight safety-assured require-concurrent-index-drop -- internal table, no traffic during deploys
```

## References

- PostgreSQL: [DROP INDEX](https://www.postgresql.org/docs/current/sql-dropindex.html) ("A normal DROP INDEX acquires an ACCESS
  EXCLUSIVE lock on the table, blocking other accesses until the index drop can be completed.
  With this option, the command instead waits until conflicting transactions have completed.")
- orm-preflight [lock verification results](https://github.com/sikandar100/orm-preflight/blob/main/test/verify/README.md) (a SELECT waits behind a waiting ALTER)
