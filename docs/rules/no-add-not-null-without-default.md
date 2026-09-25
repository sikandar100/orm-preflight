# no-add-not-null-without-default

Reports a `NOT NULL` column added to an existing table without a default, which fails as soon as the table has rows.

| Category | Default severity | Databases  |
| -------- | ---------------- | ---------- |
| locking  | error            | PostgreSQL |

## What happens

When a column is added, PostgreSQL gives every existing row the column's default. With no default,
that value is NULL, and the NOT NULL constraint rejects it:
`ERROR: column "nickname" of relation "users" contains null values`. The migration fails on every
environment that has data, often only in production.

Identity and generated columns get their values from elsewhere and are not reported here. Statements on a table created in the same migration are not reported: the table has no rows yet.

## Bad

What `migration:generate` writes for a new `@Column() nickname: string`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserNickname1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "nickname" character varying NOT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Give the column a constant default. Since PostgreSQL 11 this needs no table rewrite:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserNickname1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "nickname" character varying NOT NULL DEFAULT ''`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

In the entity: `@Column({ default: '' })`. If there is no sensible default, add the column as
nullable, backfill it in batches, and then enforce NOT NULL without a long lock, as
`no-set-not-null` describes.

## When to suppress

When the table is known to be empty in every environment.

```ts
// preflight safety-assured no-add-not-null-without-default -- feature table, created empty in 2.3
```

## References

- PostgreSQL: [ALTER TABLE, notes](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-NOTES) ("If no column
  constraints are specified, NULL is used as the DEFAULT", and a non-volatile default needs no
  rewrite)
- orm-preflight [lock verification results](../../test/verify/README.md)
