# require-not-valid-foreign-key

Reports a foreign key added to an existing table without `NOT VALID`, which blocks writes to both tables while every row is checked.

| Category | Default severity | Databases  |
| -------- | ---------------- | ---------- |
| locking  | error            | PostgreSQL |

## What happens

Adding a foreign key checks that every existing row has a matching row in the referenced table.
During the check, PostgreSQL holds a SHARE ROW EXCLUSIVE lock on both tables, which blocks
`INSERT`, `UPDATE`, and `DELETE` on them.

With `NOT VALID`, the constraint is added without the check and applies only to new and changed
rows. `VALIDATE CONSTRAINT` then checks the existing rows while holding only a SHARE UPDATE
EXCLUSIVE lock, which does not block writes.

A foreign key on a table created in the same migration is not reported: that table has no rows to
check.

## Bad

What `migration:generate` writes for a new `@ManyToOne` relation:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPostAuthor1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "posts" ADD CONSTRAINT "FK_posts_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Add the constraint with `NOT VALID`. This still takes the lock on both tables, but only briefly:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPostAuthor1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "posts" ADD CONSTRAINT "FK_posts_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION NOT VALID`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

Then validate it in a separate, later migration:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class ValidatePostAuthor1727300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "posts" VALIDATE CONSTRAINT "FK_posts_author"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

TypeORM's `createForeignKey()` cannot add `NOT VALID`, so use `queryRunner.query()`.

## When to suppress

When both tables are small, or the migration runs in a maintenance window.

```ts
// preflight safety-assured require-not-valid-foreign-key -- posts is empty until the feature launches
```

## References

- PostgreSQL: [ALTER TABLE, ADD table_constraint](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-DESC-ADD-TABLE-CONSTRAINT)
  ("ADD FOREIGN KEY also acquires a SHARE ROW EXCLUSIVE lock on the referenced table")
- PostgreSQL: [ALTER TABLE, VALIDATE CONSTRAINT](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-DESC-VALIDATE-CONSTRAINT)
  and the [notes](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-NOTES) ("validation acquires only a SHARE
  UPDATE EXCLUSIVE lock on the table being altered")
- PostgreSQL: [explicit locking, table-level locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-TABLES)
- orm-preflight [lock verification results](../../test/verify/README.md)
