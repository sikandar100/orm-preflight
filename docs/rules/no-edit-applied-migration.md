# no-edit-applied-migration

Reports a migration that already exists on the base branch and was changed, since the change will never reach databases where it already ran.

| Category    | Default severity | Databases         |
| ----------- | ---------------- | ----------------- |
| correctness | warn             | PostgreSQL, MySQL |

This rule runs only with `--changed-since <ref>`, which tells orm-preflight which migrations
already exist on the base branch. It becomes an error by default in 1.0.

## What happens

TypeORM records every migration it runs in its `migrations` table, by name. On the next run it
skips every migration whose name is already recorded, whatever the file now contains. So when an
applied migration is edited:

- databases that already ran it, such as production, never get the change
- new databases, such as test runs and fresh environments, do get it

The environments now have different schemas, and nothing reports it. The difference usually
shows up much later, as a failure that happens in only one environment.

The rule reports a file that exists on the merge base with `<ref>` and differs from it. A file
renamed without edits is not reported. A formatting-only edit is reported too, since
orm-preflight cannot tell that it changes nothing: suppress it with a reason.

## Bad

An index added to a migration that was merged and deployed last week:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserEmail1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "email" text`)
    // Added after the migration had already run in production:
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Leave the applied migration as it was, and add a new one:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserEmailIndex1727900000000 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_users_email" ON "users" ("email")`)
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

## When to suppress

When the migration has never run anywhere that matters, for example because it was added on the
same branch and the base branch is not deployed yet, or when the edit changes nothing, such as a
comment. Suppress the whole file:

```ts
// preflight safety-assured-file no-edit-applied-migration -- only reformatted, the SQL is unchanged
```

## References

- TypeORM 1.x: [`MigrationExecutor.executePendingMigrations`](https://github.com/typeorm/typeorm/blob/f279fd1367f24ad108a1b11cf833f1620274088d/packages/typeorm/src/migration/MigrationExecutor.ts#L224)
  (pending migrations are those whose name is not recorded yet)
- TypeORM 0.3.x: [`MigrationExecutor.executePendingMigrations`](https://github.com/typeorm/typeorm/blob/797320375fb83b2e9af4a6455e0b1b4483be329d/src/migration/MigrationExecutor.ts#L229)
- git: [`git merge-base`](https://git-scm.com/docs/git-merge-base), which `--changed-since` uses
  to find where the branch started
