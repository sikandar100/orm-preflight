# typeorm/transaction-override-forbidden

Reports a migration that sets its `transaction` property while TypeORM runs migrations in transaction mode `"all"`, where TypeORM refuses to run any pending migration.

| Category    | Default severity | Databases         |
| ----------- | ---------------- | ----------------- |
| correctness | error            | PostgreSQL, MySQL |

## What happens

In transaction mode `"all"`, TypeORM's default, every pending migration runs in one transaction.
Before it starts, TypeORM checks whether any pending migration sets `transaction`, to `true` or
`false`. If one does, it throws `ForbiddenTransactionModeOverrideError` and runs nothing. Every
deploy fails until the migration is changed.

The mode comes from `migrationsTransactionMode` in the DataSource, and the `-t` option of
`typeorm migration:run` overrides it. orm-preflight cannot see either, so it reads the mode from
`typeorm.transactionMode` in its own config, which defaults to `"all"`.

## Bad

With the default mode:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserEmailIndex1727200000000 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_users_email" ON "users" ("email")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Set `migrationsTransactionMode: "each"` in the DataSource:

```ts
export default new DataSource({
  // ...
  migrationsTransactionMode: 'each',
})
```

and tell orm-preflight in `orm-preflight.config.json`:

```json
{ "typeorm": { "transactionMode": "each" } }
```

Or, if the migration does not need its own setting, remove the `transaction` property.

## When to suppress

Never for this rule: set `typeorm.transactionMode` to match how you run migrations instead.

## References

- TypeORM 1.x: [`MigrationExecutor.executePendingMigrations`](https://github.com/typeorm/typeorm/blob/f279fd1367f24ad108a1b11cf833f1620274088d/packages/typeorm/src/migration/MigrationExecutor.ts#L268)
- TypeORM 0.3.x: [`MigrationExecutor.executePendingMigrations`](https://github.com/typeorm/typeorm/blob/797320375fb83b2e9af4a6455e0b1b4483be329d/src/migration/MigrationExecutor.ts#L273)
- TypeORM: [`ForbiddenTransactionModeOverrideError`](https://github.com/typeorm/typeorm/blob/f279fd1367f24ad108a1b11cf833f1620274088d/packages/typeorm/src/error/ForbiddenTransactionModeOverrideError.ts)
