# no-rename-column

Reports a renamed column, which breaks the previous version of the application while a deploy is in progress.

| Category      | Default severity | Databases         |
| ------------- | ---------------- | ----------------- |
| deploy-safety | error            | PostgreSQL, MySQL |

## What happens

`RENAME COLUMN` is quick, but it changes the name immediately. During a rolling deploy, instances
of the previous version keep running for a while and still use the old name, so every query that
touches the column fails until they are replaced.

The rule covers `RENAME COLUMN`, MySQL `CHANGE` with a new name, `queryRunner.renameColumn()`, and
`queryRunner.changeColumn()` that changes the name.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class RenameUserFullName1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "fullName" TO "displayName"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

If only the property name should change, keep the column name and skip the migration:

```ts
@Column({ name: 'fullName' })
displayName: string
```

To really rename the column, use expand and contract across releases: add the new column, write to
both, backfill, switch reads to the new column, and drop the old one later.

## When to suppress

When no running code uses the column, or when you deploy with downtime so old and new code never
run at the same time.

```ts
// preflight safety-assured no-rename-column -- column only read by the nightly job, which is paused during deploy
```

## References

- PostgreSQL: [ALTER TABLE, RENAME](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-DESC-RENAME)
- MySQL: [ALTER TABLE, renaming, redefining, and reordering columns](https://dev.mysql.com/doc/refman/8.4/en/alter-table.html#alter-table-redefine-column)
- TypeORM: [`@Column` options, `name`](https://typeorm.io/docs/entity/entities/#column-options)
