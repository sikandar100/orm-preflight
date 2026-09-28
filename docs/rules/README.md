# Rules

Every rule is an error by default, except those marked warn. Change a rule's severity in the
config, for example `{ "rules": { "no-rename-column": "warn" } }`, or set it to `"off"`.

To accept one finding, put a suppression comment with a reason above the statement:

```ts
// preflight safety-assured <rule-id> -- <reason>
```

## Data loss

| Rule                                                                      | Reports                                                          |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [`no-drop-and-recreate-column`](no-drop-and-recreate-column.md)           | A column dropped and added again in one migration                |
| [`possible-rename-data-loss`](possible-rename-data-loss.md)               | One column dropped and another added, with no data copied (warn) |
| [`no-drop-column`](no-drop-column.md)                                     | A dropped column                                                 |
| [`no-drop-table`](no-drop-table.md)                                       | A dropped table                                                  |
| [`no-truncate`](no-truncate.md)                                           | `TRUNCATE` or `clearTable()`                                     |
| [`typeorm/no-changecolumn-recreate`](typeorm/no-changecolumn-recreate.md) | `changeColumn()` that drops and re-adds the column               |
| [`typeorm/no-enum-recreate`](typeorm/no-enum-recreate.md)                 | TypeORM 0.3's enum change by recreating the type (warn)          |

## Deploy safety

| Rule                                      | Reports          |
| ----------------------------------------- | ---------------- |
| [`no-rename-column`](no-rename-column.md) | A renamed column |
| [`no-rename-table`](no-rename-table.md)   | A renamed table  |

## Locking (PostgreSQL only)

| Rule                                                                            | Reports                                                                             |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [`require-concurrent-index`](require-concurrent-index.md)                       | `CREATE INDEX` without `CONCURRENTLY`                                               |
| [`concurrent-index-transaction`](concurrent-index-transaction.md)               | `CONCURRENTLY` where it runs inside a transaction                                   |
| [`no-add-not-null-without-default`](no-add-not-null-without-default.md)         | A `NOT NULL` column added without a default                                         |
| [`no-volatile-default`](no-volatile-default.md)                                 | A column added with a volatile default, or as serial, identity, or stored generated |
| [`no-unsafe-column-type-change`](no-unsafe-column-type-change.md)               | A column type change that rewrites the table                                        |
| [`require-not-valid-foreign-key`](require-not-valid-foreign-key.md)             | A foreign key added without `NOT VALID`                                             |
| [`no-set-not-null`](no-set-not-null.md)                                         | `SET NOT NULL` on an existing column                                                |
| [`require-not-valid-check`](require-not-valid-check.md)                         | A CHECK constraint added without `NOT VALID`                                        |
| [`require-concurrent-unique`](require-concurrent-unique.md)                     | A unique constraint or primary key added in place                                   |
| [`require-concurrent-index-drop`](require-concurrent-index-drop.md)             | `DROP INDEX` without `CONCURRENTLY` (warn)                                          |
| [`no-blocking-maintenance`](no-blocking-maintenance.md)                         | `VACUUM FULL`, `CLUSTER`, or `REINDEX` without `CONCURRENTLY`                       |
| [`enum-value-used-in-same-transaction`](enum-value-used-in-same-transaction.md) | A new enum value used before the transaction that adds it commits                   |
| [`require-lock-timeout`](require-lock-timeout.md)                               | A change to an existing table without `lock_timeout` (off, opt-in)                  |

## Correctness

| Rule                                                                                  | Reports                                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [`unanalyzable-statement`](unanalyzable-statement.md)                                 | A statement orm-preflight could not read (warn)              |
| [`invalid-suppression`](invalid-suppression.md)                                       | A suppression comment with no reason or an unknown rule      |
| [`no-edit-applied-migration`](no-edit-applied-migration.md)                           | With `--changed-since`: an edit to an applied migration      |
| [`require-down`](require-down.md)                                                     | An empty or missing `down()` (warn)                          |
| [`typeorm/transaction-override-forbidden`](typeorm/transaction-override-forbidden.md) | `transaction` set on a migration in transaction mode `"all"` |
| [`typeorm/invalid-migration-name`](typeorm/invalid-migration-name.md)                 | A migration name without a 13-digit timestamp                |
