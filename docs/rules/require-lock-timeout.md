# require-lock-timeout

Reports a migration that changes an existing table without setting `lock_timeout` first, so a busy table can stall all its traffic.

| Category | Default severity | Databases  |
| -------- | ---------------- | ---------- |
| locking  | off              | PostgreSQL |

This rule is opt-in. Turn it on with `{ "rules": { "require-lock-timeout": "warn" } }`.

## What happens

Almost every schema change needs a lock on the table. Before it gets the lock, it waits for every
query already running on the table. While it waits, every new query on the table, even a plain
`SELECT`, queues behind it. A single slow query, or a long transaction left open, turns a change
that takes milliseconds into an outage that lasts as long as that query.

`lock_timeout` makes the change give up instead. When the lock does not come within the timeout,
PostgreSQL cancels the statement (`canceling statement due to lock timeout`), traffic continues,
and you can deploy again later.

The rule reports the first statement in `up()` that locks an existing table when no
`lock_timeout` was set earlier in the migration. Statements on a table created in the same migration are not reported: the table has no rows yet.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserBio1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserBio1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`)
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

Use `SET LOCAL` when the migration runs in a transaction: it ends with the transaction. In a
migration without a transaction, use `SET lock_timeout`, and `RESET lock_timeout` at the end.

## When to suppress

When the migration runs in a maintenance window, or the table has no concurrent traffic.

```ts
// preflight safety-assured require-lock-timeout -- runs before the app starts, no other connections
```

## References

- PostgreSQL: [lock_timeout](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-LOCK-TIMEOUT) ("Abort any
  statement that waits longer than the specified amount of time while attempting to acquire a
  lock on a table, index, row, or other database object.")
- PostgreSQL: [explicit locking, table-level locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-TABLES)
- orm-preflight [lock verification results](../../test/verify/README.md) (a SELECT waits behind a waiting ALTER, and lock_timeout cancels it)
