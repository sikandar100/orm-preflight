# typeorm/no-enum-recreate

Reports TypeORM's way of changing an enum by recreating the type, which rewrites every table that uses it and fails if a row holds a removed value.

| Category | Default severity | Databases  |
| -------- | ---------------- | ---------- |
| locking  | warn             | PostgreSQL |

## What happens

When an enum column's values change, `migration:generate` in TypeORM 0.3 writes four steps:

1. Rename the type to `<name>_old`.
2. Create a new type with the new values.
3. Convert every column that uses it with `ALTER COLUMN ... TYPE ... USING`.
4. Drop the old type.

Step 3 rewrites each table under an ACCESS EXCLUSIVE lock, which blocks every read and write
until the rewrite finishes. If any row holds a value that the new type no longer has, the
conversion fails: `invalid input value for enum`.

TypeORM 0.3 does this even when values are only added. TypeORM 1.x writes
`ALTER TYPE ... ADD VALUE` for that case, which changes no rows.

Each column's rewrite is also reported by `no-unsafe-column-type-change`. This rule explains the
pattern and the better alternative. Columns on tables created in the same migration are not
reported.

## Bad

What TypeORM 0.3 generates after adding `'banned'` to an enum:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddBannedStatus1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."users_status_enum" RENAME TO "users_status_enum_old"`,
    )
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'inactive', 'banned')`,
    )
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "status" TYPE "public"."users_status_enum" USING "status"::"text"::"public"."users_status_enum"`,
    )
    await queryRunner.query(`DROP TYPE "public"."users_status_enum_old"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

When you only add values, replace the generated statements with one that adds the value:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddBannedStatus1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."users_status_enum" ADD VALUE 'banned'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

To rename a value, use `ALTER TYPE ... RENAME VALUE`. To remove values, use expand and contract:
add a column with the new type, backfill it, switch the code, and drop the old column later.

## When to suppress

When every table that uses the enum is small, or the migration runs in a maintenance window.

```ts
// preflight safety-assured typeorm/no-enum-recreate -- status is only used by the 200-row plans table
```

## References

- PostgreSQL: [ALTER TYPE](https://www.postgresql.org/docs/current/sql-altertype.html) (`ADD VALUE` and `RENAME VALUE`)
- PostgreSQL: [ALTER TABLE, SET DATA TYPE](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-DESC-SET-DATA-TYPE)
  (a conversion with USING rewrites the table)
- TypeORM 0.3.x: [`PostgresQueryRunner.changeColumn`, enum branch](https://github.com/typeorm/typeorm/blob/797320375fb83b2e9af4a6455e0b1b4483be329d/src/driver/postgres/PostgresQueryRunner.ts#L1590)
  (`ALTER TYPE ... RENAME TO ..._old`)
- orm-preflight [lock verification results](https://github.com/sikandar100/orm-preflight/blob/main/test/verify/README.md) (the recreate pattern
  rewrites the table; `ADD VALUE` does not; a removed value makes it fail)
