# no-drop-column

Reports a dropped column, which deletes its data and breaks application code that still uses it.

| Category  | Default severity | Databases         |
| --------- | ---------------- | ----------------- |
| data-loss | error            | PostgreSQL, MySQL |

## What happens

`DROP COLUMN` deletes the column's data when the migration commits. PostgreSQL does not physically
remove the data at once, but it becomes invisible to SQL and cannot be read back.

During a deploy, instances running the previous version of the application still select, insert,
or update the column. TypeORM lists every mapped column in its queries, so those instances fail
until they are replaced.

## Bad

After deleting the `bio` property from the `User` entity:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class RemoveUserBio1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Release the code change first: remove the property from the entity and deploy it, without a
migration. Once no running instance uses the column, drop it in a later release and record why it
is safe:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropUserBio1727300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // preflight safety-assured no-drop-column -- bio removed from the entity in 2.3, deployed everywhere
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## When to suppress

In the second step of the pattern above, once the code that used the column is gone everywhere and
its data is no longer needed.

## References

- PostgreSQL: [ALTER TABLE, DROP COLUMN](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-DESC-DROP-COLUMN)
  and the [notes](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-NOTES) ("The DROP COLUMN form does not
  physically remove the column, but simply makes it invisible to SQL operations.")
- MySQL: [ALTER TABLE](https://dev.mysql.com/doc/refman/8.4/en/alter-table.html)
