# concurrent-index-transaction

Reports `CREATE INDEX`, `DROP INDEX`, or `REINDEX` with `CONCURRENTLY` in a place where PostgreSQL runs it inside a transaction, which makes the migration fail.

| Category | Default severity | Databases  |
| -------- | ---------------- | ---------- |
| locking  | error            | PostgreSQL |

## What happens

PostgreSQL refuses to run a concurrent index operation inside a transaction block:
`ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`. The migration fails, and
with TypeORM's default settings no later migration runs either.

This happens in three ways, and the rule reports each:

1. **The migration runs in a transaction.** TypeORM's default `migrationsTransactionMode` is `"all"`,
   which wraps every pending migration in one transaction. In mode `"each"`, each migration gets its
   own transaction unless it sets `transaction = false`.
2. **The statement shares a `query()` call with other statements.** PostgreSQL runs a string with
   several statements as one implicit transaction, even when the migration has no transaction.
3. **The transaction setting is not a constant**, such as `transaction = process.env.X === '1'`.
   orm-preflight cannot tell, so this case is a warning.

orm-preflight reads the effective mode from `typeorm.transactionMode` in its config (default
`"all"`). A migration that calls `queryRunner.commitTransaction()` before the statement and
`queryRunner.startTransaction()` after it is understood as running outside a transaction.

## Bad

With the default mode `"all"`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserEmailIndex1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_users_email" ON "users" ("email")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

Two statements in one call, which fails even with `transaction = false`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserIndexes1727200000000 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY "IDX_a" ON "users" ("a"); CREATE INDEX CONCURRENTLY "IDX_b" ON "users" ("b")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Set `migrationsTransactionMode: "each"` in the DataSource, opt the migration out, and give each
statement its own `query()` call:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserIndexes1727200000000 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_a" ON "users" ("a")`)
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_b" ON "users" ("b")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

and in `orm-preflight.config.json`:

```json
{ "typeorm": { "transactionMode": "each" } }
```

Keep each concurrent migration small: without a transaction, a failure halfway leaves the earlier
statements applied.

**Reverting.** `typeorm migration:revert` runs `down()` in a transaction unless the transaction mode
is `"none"`, and it ignores `transaction = false`. A `DROP INDEX CONCURRENTLY` in `down()` therefore
fails on revert. Use a plain `DROP INDEX` in `down()`, or revert with `typeorm migration:revert -t none`.

## When to suppress

Only when the migration is run by something other than TypeORM's migration runner, outside a
transaction, and orm-preflight cannot see that.

## References

- PostgreSQL: [CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY) ("a regular
  CREATE INDEX command can be performed within a transaction block, but CREATE INDEX CONCURRENTLY
  cannot"), [DROP INDEX](https://www.postgresql.org/docs/current/sql-dropindex.html), [REINDEX](https://www.postgresql.org/docs/current/sql-reindex.html#SQL-REINDEX-CONCURRENTLY)
- PostgreSQL: [multiple statements in a simple query](https://www.postgresql.org/docs/current/protocol-flow.html#PROTOCOL-FLOW-MULTI-STATEMENT)
  (they run "in an implicit transaction block")
- TypeORM: [`MigrationExecutor`](https://github.com/typeorm/typeorm/blob/f279fd1367f24ad108a1b11cf833f1620274088d/packages/typeorm/src/migration/MigrationExecutor.ts#L268) (transaction modes) and
  [`undoLastMigration`](https://github.com/typeorm/typeorm/blob/f279fd1367f24ad108a1b11cf833f1620274088d/packages/typeorm/src/migration/MigrationExecutor.ts#L398) (revert)
- orm-preflight [lock verification results](../../test/verify/README.md)
