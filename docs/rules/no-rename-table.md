# no-rename-table

Reports a renamed table, which breaks the previous version of the application while a deploy is in progress.

| Category      | Default severity | Databases         |
| ------------- | ---------------- | ----------------- |
| deploy-safety | error            | PostgreSQL, MySQL |

## What happens

Renaming a table is quick, but instances of the previous version keep using the old name until they
are replaced, and every query they run on the table fails.

The rule covers `ALTER TABLE ... RENAME TO`, MySQL `RENAME TABLE`, and `queryRunner.renameTable()`.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class RenameCustomers1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "customer" RENAME TO "customers"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

If only the entity name should change, keep the table name: `@Entity('customer') class Customers`.

To really rename it, create the new table (or rename it and leave a view with the old name for the
old code), copy the data, switch the code, and drop the old name in a later release.

## When to suppress

When no running code uses the table, or when you deploy with downtime.

```ts
// preflight safety-assured no-rename-table -- table is new in this release and not yet used
```

## References

- PostgreSQL: [ALTER TABLE, RENAME](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-DESC-RENAME)
- MySQL: [RENAME TABLE](https://dev.mysql.com/doc/refman/8.4/en/rename-table.html)
- TypeORM: [`@Entity` options](https://typeorm.io/docs/entity/entities/)
