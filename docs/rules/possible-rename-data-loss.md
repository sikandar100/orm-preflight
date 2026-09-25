# possible-rename-data-loss

Warns when a migration drops one column and adds a different one on the same table without copying data, which is what a renamed entity property produces.

| Category  | Default severity | Databases         |
| --------- | ---------------- | ----------------- |
| data-loss | warn             | PostgreSQL, MySQL |

## What happens

When you rename an entity property and its column name follows, `migration:generate` cannot tell
a rename from a removal plus an addition. Depending on the change it writes `RENAME COLUMN`, or it
drops the old column and adds the new one. In the second case the old values are deleted and the
new column starts empty.

This rule fires when a migration drops exactly one column and adds exactly one other column on the
same table, and no `INSERT` or `UPDATE` on that table between the add and the drop copies the
data. It is a warning because the two columns may really be unrelated. The dropped column is still
reported by `no-drop-column`.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class RenameUserFullName1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "fullName"`)
    await queryRunner.query(`ALTER TABLE "users" ADD "displayName" character varying`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Keep the data with expand and contract. First release: add the new column and backfill it.

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserDisplayName1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "displayName" character varying`)
    await queryRunner.query(`UPDATE "users" SET "displayName" = "fullName"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

Switch the code to the new column, then drop `fullName` in a later release. If you only want a new
property name, keep the column name instead: `@Column({ name: 'fullName' }) displayName: string`
needs no migration at all.

## When to suppress

When the two columns are unrelated, for example one feature is removed and another is added in the
same migration.

```ts
// preflight safety-assured possible-rename-data-loss -- fullName is unused since 2.4; displayName is new
```

## References

- PostgreSQL: [ALTER TABLE, DROP COLUMN](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-DESC-DROP-COLUMN)
- MySQL: [ALTER TABLE](https://dev.mysql.com/doc/refman/8.4/en/alter-table.html)
- TypeORM: [`@Column` options, `name`](https://typeorm.io/docs/entity/entities/#column-options)
