# no-blocking-maintenance

Reports `VACUUM FULL`, `CLUSTER`, and `REINDEX` without `CONCURRENTLY`, which block the table for as long as they run.

| Category | Default severity | Databases  |
| -------- | ---------------- | ---------- |
| locking  | warn             | PostgreSQL |

It becomes an error by default in 1.0.

## What happens

- **`VACUUM FULL`** writes a new copy of the table under an ACCESS EXCLUSIVE lock, which blocks
  all reads and writes until it finishes. It also cannot run inside a transaction, so in a
  migration that runs in one, PostgreSQL rejects it: `VACUUM cannot run inside a transaction block`.
- **`CLUSTER`** also rewrites the table under an ACCESS EXCLUSIVE lock.
- **`REINDEX`** without `CONCURRENTLY` blocks writes to the table, and reads that use the index,
  until the rebuild finishes.

These commands take as long as the table is big, often minutes or hours. Plain `VACUUM` and
`ANALYZE` do not block and are not reported.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class RebuildUserEmailIndex1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REINDEX INDEX "IDX_users_email"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Rebuild the index concurrently, in a migration without a transaction:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class RebuildUserEmailIndex1727200000000 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REINDEX INDEX CONCURRENTLY "IDX_users_email"`)
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

Do not run `VACUUM FULL` or `CLUSTER` from a migration. Run them in a maintenance window, or use
a tool that rebuilds tables online, such as pg_repack.

## When to suppress

When the table is small, or the migration runs in a maintenance window.

```ts
// preflight safety-assured no-blocking-maintenance -- lookup table with 40 rows
```

## References

- PostgreSQL: [VACUUM](https://www.postgresql.org/docs/current/sql-vacuum.html) ("requires an ACCESS EXCLUSIVE lock on each table
  while it is being processed", "VACUUM cannot be executed inside a transaction block")
- PostgreSQL: [CLUSTER](https://www.postgresql.org/docs/current/sql-cluster.html) ("When a table is being clustered, an ACCESS
  EXCLUSIVE lock is acquired on it.")
- PostgreSQL: [REINDEX](https://www.postgresql.org/docs/current/sql-reindex.html) ("REINDEX locks out writes but not reads of the
  index's parent table. It also takes an ACCESS EXCLUSIVE lock on the specific index being
  processed, which will block reads that attempt to use that index.") and
  [rebuilding indexes concurrently](https://www.postgresql.org/docs/current/sql-reindex.html#SQL-REINDEX-CONCURRENTLY)
- orm-preflight [lock verification results](../../test/verify/README.md)
