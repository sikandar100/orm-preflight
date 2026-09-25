# no-drop-table

Reports a dropped table, which deletes all of its rows and breaks application code that still uses it.

| Category  | Default severity | Databases         |
| --------- | ---------------- | ----------------- |
| data-loss | error            | PostgreSQL, MySQL |

## What happens

`DROP TABLE` removes the table definition and all of its data when the migration commits. On
MySQL, DDL statements commit on their own, so a `DROP TABLE` cannot be rolled back even when a
later statement in the migration fails.

Instances still running the previous version of the application fail on every query to the table
until they are replaced.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class RemoveAuditLog1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_log"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Remove the entity and every use of it first, and deploy that. Drop the table in a later release,
after you have archived any data you need:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropAuditLog1727300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // preflight safety-assured no-drop-table -- entity removed in 2.3, rows archived to S3 on 2026-09-01
    await queryRunner.query(`DROP TABLE "audit_log"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## When to suppress

In the second step of the pattern above, or for a table that only ever held temporary data.

## References

- PostgreSQL: [DROP TABLE](https://www.postgresql.org/docs/current/sql-droptable.html)
- MySQL: [DROP TABLE](https://dev.mysql.com/doc/refman/8.4/en/drop-table.html) ("Be careful with this statement! For each table, it
  removes the table definition and all table data.") and
  [statements that cause an implicit commit](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html)
