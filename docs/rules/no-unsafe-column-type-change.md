# no-unsafe-column-type-change

Reports a column type change that rewrites the whole table while blocking reads and writes.

| Category | Default severity | Databases  |
| -------- | ---------------- | ---------- |
| locking  | error            | PostgreSQL |

## What happens

`ALTER COLUMN ... TYPE` holds an ACCESS EXCLUSIVE lock, which blocks every read and write. Unless
the old and new types store values the same way, PostgreSQL also rewrites the table and rebuilds
its indexes while holding that lock. On a large table this can take a long time.

These changes do not rewrite, and are not reported:

- `varchar(n)` to a longer `varchar(m)`
- `varchar` to `text`, or to `varchar` without a length

Every other change is reported, and so is any change with a `USING` expression.

Known limits:

- orm-preflight does not know the old type. A change to `varchar(n)` is treated as a widening,
  but shortening a `varchar` does rewrite, and fails if a value is too long.
- Some other changes also avoid a rewrite and are reported anyway, such as `timestamp` to
  `timestamptz` when the session time zone is UTC (PostgreSQL 12 and later), or a larger `numeric`
  precision. Suppress those with a reason.

Statements on a table created in the same migration are not reported: the table has no rows yet.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class WidenUserAge1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "age" TYPE bigint`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Expand and contract: add a column with the new type, backfill it in batches, switch the code to it,
and drop the old column in a later release.

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserAgeBigint1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "age_new" bigint`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## When to suppress

When the table is small, when the change is known not to rewrite (see the limits above), or when
the migration runs in a maintenance window.

```ts
// preflight safety-assured no-unsafe-column-type-change -- timestamp to timestamptz with TimeZone = UTC, no rewrite on PG 16
```

## References

- PostgreSQL: [ALTER TABLE, SET DATA TYPE](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-DESC-SET-DATA-TYPE)
  and the [notes](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-NOTES) ("when changing the type of an
  existing column, if the USING clause does not change the column contents and the old type is
  either binary coercible to the new type or an unconstrained domain over the new type, a table
  rewrite is not needed")
- orm-preflight [lock verification results](../../test/verify/README.md)
