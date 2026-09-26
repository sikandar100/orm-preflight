# require-down

Reports a migration whose `down()` is empty or missing, so reverting it changes nothing but still marks it as not applied.

| Category    | Default severity | Databases         |
| ----------- | ---------------- | ----------------- |
| correctness | warn             | PostgreSQL, MySQL |

## What happens

`typeorm migration:revert` runs the last migration's `down()`, then deletes the migration from
the `migrations` table. With an empty `down()`, nothing in the database changes, but TypeORM now
records the migration as not applied. The next `migration:run` runs its `up()` again on a schema
that already has its changes, and usually fails, for example with `column "bio" already exists`.

A `down()` that only has comments counts as empty. A `down()` that throws does not: throwing is
the right way to say a migration cannot be reverted.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserBio1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // nothing to undo
  }
}
```

## Safe

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserBio1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`)
  }
}
```

When the change cannot be undone, for example because it deletes data, say so:

```ts
public async down(): Promise<void> {
  throw new Error('This migration deletes the legacy table and cannot be reverted.')
}
```

## When to suppress

Rarely: a `down()` that throws is clearer than a suppression. Suppress when reverting is never
used in your deploy process and the team agrees on that.

```ts
// preflight safety-assured require-down -- we only roll forward; reverts are new migrations
```

## References

- TypeORM 1.x: [`MigrationExecutor.undoLastMigration`](https://github.com/typeorm/typeorm/blob/f279fd1367f24ad108a1b11cf833f1620274088d/packages/typeorm/src/migration/MigrationExecutor.ts#L466)
  (runs `down()`, then deletes the migration record)
- TypeORM 0.3.x: [`MigrationExecutor.undoLastMigration`](https://github.com/typeorm/typeorm/blob/797320375fb83b2e9af4a6455e0b1b4483be329d/src/migration/MigrationExecutor.ts#L472)
