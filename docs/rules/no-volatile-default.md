# no-volatile-default

Reports a column added with a volatile default, or as a serial, identity, or stored generated column, which rewrites the whole table under an exclusive lock.

| Category | Default severity | Databases  |
| -------- | ---------------- | ---------- |
| locking  | error            | PostgreSQL |

## What happens

A new column with a constant default, or a stable one such as `now()`, is added instantly: the
value is stored once in the table's metadata. A volatile default must be computed for every
existing row, so PostgreSQL rewrites the table and its indexes while holding an ACCESS EXCLUSIVE
lock, which blocks all reads and writes until it finishes. The same happens for `serial`, identity,
and stored generated columns.

orm-preflight treats these functions as volatile: `random`, `gen_random_uuid`, `uuid_generate_v1`,
`uuid_generate_v4`, `clock_timestamp`, `timeofday`, and `nextval`. A default that calls another
volatile function, such as one of your own, is not detected.

In TypeORM this comes from, for example, `@Generated('uuid')`, `@PrimaryGeneratedColumn()` on an
existing table, or `@Column({ default: () => 'gen_random_uuid()' })`. Statements on a table created in the same migration are not reported: the table has no rows yet.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserToken1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "token" uuid NOT NULL DEFAULT gen_random_uuid()`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Add the column without a default, then set the default in a separate statement. `SET DEFAULT`
applies only to new rows, so neither statement rewrites the table:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserToken1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "token" uuid`)
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "token" SET DEFAULT gen_random_uuid()`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

Then fill existing rows in batches, and add NOT NULL without a long lock as `no-set-not-null`
describes. For a serial column, add a plain integer column, create a sequence, and set the
default to `nextval(...)` the same way. For a computed column, add a plain column and fill it in
batches.

## When to suppress

When the table is small enough that a short full rewrite is acceptable, or the migration runs in a
maintenance window.

```ts
// preflight safety-assured no-volatile-default -- api_keys has under 1,000 rows
```

## References

- PostgreSQL: [ALTER TABLE, notes](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-NOTES) ("Adding a column
  with a volatile DEFAULT (e.g., clock_timestamp()), a stored generated column, an identity column,
  or a column with a domain data type that has constraints will cause the entire table and its
  indexes to be rewritten.")
- orm-preflight [lock verification results](../../test/verify/README.md)
