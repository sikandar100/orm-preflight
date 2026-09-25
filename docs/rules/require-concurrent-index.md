# require-concurrent-index

Reports `CREATE INDEX` without `CONCURRENTLY`, which blocks writes to the table while the index is built.

| Category | Default severity | Databases  |
| -------- | ---------------- | ---------- |
| locking  | error            | PostgreSQL |

## What happens

A plain `CREATE INDEX` holds a SHARE lock on the table until the build finishes. Reads continue,
but every `INSERT`, `UPDATE`, and `DELETE` waits. On a large table the build can take minutes.

`CREATE INDEX CONCURRENTLY` builds the index without blocking writes. It takes longer, and it
cannot run inside a transaction (see `concurrent-index-transaction`), which TypeORM uses by
default.

Statements on a table created in the same migration are not reported: the table has no rows yet. MySQL is not checked: InnoDB adds secondary indexes without blocking writes.

## Bad

What `migration:generate` writes for a new `@Index()`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserEmailIndex1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Build the index concurrently, alone in its `query()` call, in a migration that opts out of the
transaction:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserEmailIndex1727200000000 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_users_email" ON "users" ("email")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

TypeORM only honors `transaction = false` when the DataSource has `migrationsTransactionMode: "each"`.
Tell orm-preflight about it in `orm-preflight.config.json`:

```json
{ "typeorm": { "transactionMode": "each" } }
```

With builder calls, set `isConcurrent: true` on the `TableIndex`. If a concurrent build fails, it
leaves an INVALID index behind: drop it before you retry.

## When to suppress

When the table is small enough that a short block on writes is acceptable, or the migration runs in
a maintenance window.

```ts
// preflight safety-assured require-concurrent-index -- countries has 250 rows
```

## References

- PostgreSQL: [CREATE INDEX, building indexes concurrently](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)
  ("a standard index build locks out writes (but not reads) on the table until it's done")
- PostgreSQL: [explicit locking, table-level locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-TABLES)
- MySQL: [online DDL, index operations](https://dev.mysql.com/doc/refman/8.4/en/innodb-online-ddl-operations.html)
- TypeORM: [`TableIndexOptions.isConcurrent`](https://github.com/typeorm/typeorm/blob/f279fd1367f24ad108a1b11cf833f1620274088d/packages/typeorm/src/schema-builder/options/TableIndexOptions.ts)
- orm-preflight [lock verification results](../../test/verify/README.md)
