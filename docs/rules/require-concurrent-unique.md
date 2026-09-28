# require-concurrent-unique

Reports a unique constraint or primary key added to an existing table, which builds its index while blocking reads and writes.

| Category | Default severity | Databases  |
| -------- | ---------------- | ---------- |
| locking  | error            | PostgreSQL |

## What happens

`ADD CONSTRAINT ... UNIQUE` and `ADD CONSTRAINT ... PRIMARY KEY` build a new index. They build it
while holding an ACCESS EXCLUSIVE lock, which blocks every read and write on the table until the
build finishes. On a large table that can take minutes.

The safe way builds the index with `CREATE UNIQUE INDEX CONCURRENTLY`, which does not block
writes, and then attaches it with `ADD CONSTRAINT ... USING INDEX`. Attaching needs only a brief
lock, since the index already exists. PostgreSQL renames the index to the constraint's name.

A primary key also needs its columns to be NOT NULL. If they are not yet, adding the key sets
NOT NULL with a full scan (see `no-set-not-null`).

Statements on a table created in the same migration are not reported: the table has no rows yet.

## Bad

What `migration:generate` writes for `@Column({ unique: true })` on an existing column:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserEmailUnique1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_users_email" UNIQUE ("email")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

First build the index concurrently, in a migration without a transaction:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserEmailUniqueIndex1727200000000 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX CONCURRENTLY "UQ_users_email" ON "users" ("email")`,
    )
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

Then attach it in a later migration:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AttachUserEmailUnique1727300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_users_email" UNIQUE USING INDEX "UQ_users_email"`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## When to suppress

When the table is small, or the migration runs in a maintenance window.

```ts
// preflight safety-assured require-concurrent-unique -- countries has 250 rows
```

## References

- PostgreSQL: [ALTER TABLE, ADD table_constraint_using_index](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-DESC-ADD-TABLE-CONSTRAINT-USING-INDEX),
  and its example "To recreate a primary key constraint, without blocking updates while the index
  is rebuilt", which uses `CREATE UNIQUE INDEX CONCURRENTLY` and `PRIMARY KEY USING INDEX`
- PostgreSQL: [CREATE INDEX, building indexes concurrently](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)
- orm-preflight [lock verification results](https://github.com/sikandar100/orm-preflight/blob/main/test/verify/README.md)
