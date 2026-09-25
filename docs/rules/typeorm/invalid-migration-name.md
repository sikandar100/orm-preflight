# typeorm/invalid-migration-name

Reports a migration whose name does not end with a 13-digit timestamp, which makes TypeORM refuse to load any migration.

| Category    | Default severity | Databases         |
| ----------- | ---------------- | ----------------- |
| correctness | error            | PostgreSQL, MySQL |

## What happens

TypeORM reads each migration's timestamp from the last 13 characters of its `name` property, or of
the class name when `name` is not set. If they do not parse as a number, TypeORM throws
`<name> migration name is wrong. Migration class name should have a JavaScript timestamp appended.`
while loading migrations, and no pending migration runs.

TypeORM 0.3.x treats an empty `name` as missing and falls back to the class name. TypeORM 1.x uses
the empty name and throws. orm-preflight follows 1.x.

When `name` is not a constant, orm-preflight cannot check it and reports `unanalyzable-statement`
instead.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUsersEmail implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "email" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUsersEmail1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "email" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

`typeorm migration:generate` and `typeorm migration:create` add the timestamp for you. If you set
`name`, it must end with the timestamp too.

## When to suppress

Never: TypeORM cannot run the migration.

## References

- TypeORM 1.x: [`MigrationExecutor.getMigrations`](https://github.com/typeorm/typeorm/blob/f279fd1367f24ad108a1b11cf833f1620274088d/packages/typeorm/src/migration/MigrationExecutor.ts#L587)
- TypeORM 0.3.x: [`MigrationExecutor.getMigrations`](https://github.com/typeorm/typeorm/blob/797320375fb83b2e9af4a6455e0b1b4483be329d/src/migration/MigrationExecutor.ts#L589)
