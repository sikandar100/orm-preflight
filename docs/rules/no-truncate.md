# no-truncate

Reports `TRUNCATE` and `queryRunner.clearTable()`, which delete every row of a table.

| Category  | Default severity | Databases         |
| --------- | ---------------- | ----------------- |
| data-loss | error            | PostgreSQL, MySQL |

## What happens

`TRUNCATE` removes all rows at once. TypeORM's `clearTable()` runs `TRUNCATE TABLE`.

- On PostgreSQL it takes an ACCESS EXCLUSIVE lock, which blocks every read and write on the table
  until the migration's transaction ends. It is also not MVCC-safe: transactions that started
  before it see the table as empty.
- On MySQL it causes an implicit commit, so it cannot be rolled back.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class ResetSessions1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.clearTable('sessions')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Delete only the rows you mean to remove, in batches, with `DELETE ... WHERE`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class PruneSessions1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "sessions" WHERE "expiresAt" < now() - interval '30 days'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## When to suppress

When the table only holds data that can be rebuilt, such as a cache, and briefly blocking it is
acceptable.

```ts
// preflight safety-assured no-truncate -- sessions are recreated on next login
```

## References

- PostgreSQL: [TRUNCATE](https://www.postgresql.org/docs/current/sql-truncate.html) ("TRUNCATE acquires an ACCESS EXCLUSIVE lock on each
  table it operates on", "TRUNCATE is not MVCC-safe")
- MySQL: [TRUNCATE TABLE](https://dev.mysql.com/doc/refman/8.4/en/truncate-table.html) ("Truncate operations cause an implicit commit,
  and so cannot be rolled back.")
- TypeORM: [`PostgresQueryRunner.clearTable`](https://github.com/typeorm/typeorm/blob/f279fd1367f24ad108a1b11cf833f1620274088d/packages/typeorm/src/driver/postgres/PostgresQueryRunner.ts#L3405)
