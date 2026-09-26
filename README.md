# orm-preflight

Preflight safety checks for TypeORM migrations: catch data loss and locking before you merge.

Changing a column's length in TypeORM can delete all of its data. When a column's type or length
changes, TypeORM's migration generator drops the column and adds it again
([typeorm/typeorm#3357](https://github.com/typeorm/typeorm/issues/3357)). The migration looks
harmless in review and passes every test on an empty database. orm-preflight catches that, and
other migrations that lose data, lock busy tables, or break a rolling deploy, before you merge.

```
src/migrations/1727100000000-WidenUserName.ts
  7:30  error  no-drop-and-recreate-column
        "users"."name" is dropped and re-added in the same migration. Every existing value in this column will be lost.
        Why:  TypeORM drops and re-adds a column when its type or length changes, instead of changing it in place. The new column starts empty.
        Safe: Change the type in place: ALTER TABLE "users" ALTER COLUMN "name" TYPE varchar(255). Widening a varchar, or changing varchar to text, does not rewrite the table. ...
        Docs: https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-drop-and-recreate-column.md

  8:30  error  no-add-not-null-without-default
        "users"."name" is added as NOT NULL without a default. The migration fails as soon as "users" has any rows.
        ...

2 errors, 0 warnings in 1 migration
```

## Install and run

```sh
npm install --save-dev orm-preflight
npx orm-preflight "src/migrations/*.ts"
```

Node.js 20 or newer. Without arguments, orm-preflight checks the `migrations` globs from its
config, or every `migrations` folder in the project.

To start on an existing project without fixing its history, run `npx orm-preflight init` first
(see [Adopting on an existing project](#adopting-on-an-existing-project)).

## What it catches

| Rule                                                                                                                                                    | Reports                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Data loss**                                                                                                                                           |                                                                                                 |
| [`no-drop-and-recreate-column`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-drop-and-recreate-column.md)                       | A column dropped and added again in one migration                                               |
| [`possible-rename-data-loss`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/possible-rename-data-loss.md)                           | One column dropped and another added, with no data copied (warning)                             |
| [`no-drop-column`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-drop-column.md)                                                 | A dropped column                                                                                |
| [`no-drop-table`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-drop-table.md)                                                   | A dropped table                                                                                 |
| [`no-truncate`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-truncate.md)                                                       | `TRUNCATE` or `clearTable()`                                                                    |
| [`typeorm/no-changecolumn-recreate`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/typeorm/no-changecolumn-recreate.md)             | `changeColumn()` that drops and re-adds the column                                              |
| **Deploy safety**                                                                                                                                       |                                                                                                 |
| [`no-rename-column`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-rename-column.md)                                             | A renamed column                                                                                |
| [`no-rename-table`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-rename-table.md)                                               | A renamed table                                                                                 |
| **Locking (PostgreSQL)**                                                                                                                                |                                                                                                 |
| [`require-concurrent-index`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/require-concurrent-index.md)                             | `CREATE INDEX` without `CONCURRENTLY`                                                           |
| [`concurrent-index-transaction`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/concurrent-index-transaction.md)                     | `CONCURRENTLY` where it runs inside a transaction                                               |
| [`no-add-not-null-without-default`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-add-not-null-without-default.md)               | A `NOT NULL` column added without a default                                                     |
| [`no-volatile-default`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-volatile-default.md)                                       | A column added with a volatile default, or as serial, identity, or generated                    |
| [`no-unsafe-column-type-change`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-unsafe-column-type-change.md)                     | A column type change that rewrites the table                                                    |
| [`require-not-valid-foreign-key`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/require-not-valid-foreign-key.md)                   | A foreign key added without `NOT VALID`                                                         |
| [`no-set-not-null`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-set-not-null.md)                                               | `SET NOT NULL` on an existing column                                                            |
| **Correctness**                                                                                                                                         |                                                                                                 |
| [`typeorm/transaction-override-forbidden`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/typeorm/transaction-override-forbidden.md) | `transaction` set on a migration in transaction mode `"all"`                                    |
| [`typeorm/invalid-migration-name`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/typeorm/invalid-migration-name.md)                 | A migration name without a 13-digit timestamp                                                   |
| [`unanalyzable-statement`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/unanalyzable-statement.md)                                 | A statement orm-preflight could not read (warning)                                              |
| [`invalid-suppression`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/invalid-suppression.md)                                       | A suppression comment with no reason or an unknown rule                                         |
| [`no-edit-applied-migration`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-edit-applied-migration.md)                           | With `--changed-since`: an edit to a migration that already exists on the base branch (warning) |

Every finding says what happens, why, and how to make the change safely. Each rule's page cites
the PostgreSQL, MySQL, or TypeORM source behind its claim. Run `npx orm-preflight explain <rule>`
to read it in the terminal, or `npx orm-preflight rules` for the list.

Changes to a table created in the same migration are not reported: it has no rows yet.

## Command line

```
orm-preflight [files or globs...] [options]

  -c, --config <path>         Config file (default: orm-preflight.config.json, then the
                              "ormPreflight" key in package.json)
  --dialect <postgres|mysql>  Database dialect (default: postgres)
  --postgres-version <n>      PostgreSQL major version the migrations run on (default: 16)
  --orm <typeorm>             ORM adapter (default: typeorm)
  --changed-since <git-ref>   Check only migrations added or changed since the merge base
                              with <git-ref>, such as origin/main
  --format <pretty|json>      Output format (default: pretty)
  --max-warnings <n>          Fail when there are more than n warnings (default: no limit)
  --no-color                  Print without colors

orm-preflight rules                      List every rule
orm-preflight explain <rule>             Print a rule's documentation
orm-preflight init [files or globs...]   Write a starter config
```

| Exit code | Meaning                                               |
| --------- | ----------------------------------------------------- |
| `0`       | No errors, and no more warnings than `--max-warnings` |
| `1`       | Errors, or more warnings than `--max-warnings`        |
| `2`       | Usage, config, or internal error                      |

`--format json` prints every finding, including suppressed ones. Its shape is public API and is
described in [docs/json-output.md](https://github.com/sikandar100/orm-preflight/blob/main/docs/json-output.md).

## Configuration

Put the config in `orm-preflight.config.json`, or under the `"ormPreflight"` key of
`package.json`. Only JSON is supported, so a pull request cannot run code through the config.

```json
{
  "$schema": "./node_modules/orm-preflight/schema.json",
  "orm": "typeorm",
  "dialect": "postgres",
  "postgresVersion": 16,
  "migrations": ["src/migrations/*.ts"],
  "startAfter": 1727000000000,
  "typeorm": { "transactionMode": "each" },
  "rules": { "no-rename-column": "warn" }
}
```

| Key                       | Meaning                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `migrations`              | Globs of migration files. Default: every `migrations` folder.                                              |
| `startAfter`              | A migration timestamp. Migrations at or before it are not checked.                                         |
| `postgresVersion`         | The PostgreSQL major version you run, 12 or newer. Some safe alternatives depend on it. Default: 16.       |
| `defaultSchema`           | The schema of unqualified table names. Default: `public` on PostgreSQL.                                    |
| `typeorm.transactionMode` | Must match `migrationsTransactionMode` in your DataSource: `all` (the TypeORM default), `each`, or `none`. |
| `rules`                   | Severity per rule: `error`, `warn`, or `off`.                                                              |

Command-line flags override the config.

## Adopting on an existing project

```sh
npx orm-preflight init
```

`init` writes `orm-preflight.config.json` with `startAfter` set to your newest migration, so only
migrations you add from now on are checked. It reads your migration files but never runs them.

On pull requests, you can also check only the migrations the branch adds or changes:

```sh
npx orm-preflight --changed-since origin/main
```

It compares against the merge base with `origin/main` and includes uncommitted and untracked
files. Tables created by any of the changed migrations count as new for all of them. Editing a
migration that already exists on `origin/main` is reported by `no-edit-applied-migration`. In
GitHub Actions, check out with `fetch-depth: 0` so the merge base is available.

## Continuous integration

Run it as a step in any CI. It needs no database and no secrets, so it is safe on pull requests
from forks. On GitHub Actions:

```yaml
- uses: actions/checkout@v7
- uses: actions/setup-node@v7
  with:
    node-version: 22
- run: npm ci
- run: npx orm-preflight
```

## Suppressing a finding

When a finding is expected, say why in a comment above the statement:

```ts
// preflight safety-assured no-drop-column -- bio removed from the entity in 2.3, deployed everywhere
await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`)
```

The reason is required, so suppressions form an audit trail. For a whole file, put
`/* preflight safety-assured-file <rule> -- <reason> */` anywhere in it. A suppression with no reason or an unknown
rule is itself an error.

## How it works

orm-preflight parses each migration file with Babel and reads the SQL strings passed to
`queryRunner.query()` and the builder calls such as `addColumn()` and `createIndex()`. It parses
the SQL with the PostgreSQL parser (libpg-query) or a MySQL parser, and runs its rules on the
result.

It never imports or runs your migrations, never connects to a database, and never loads
TypeORM. Anything it cannot read, such as SQL built at run time, is reported as
`unanalyzable-statement` instead of being skipped silently.

## What a clean run means

A clean run means none of the documented hazards were found. It does not guarantee that a
migration is safe. orm-preflight does not know your table sizes or traffic, so it assumes every
existing table is large and busy.

Limitations in 0.1.0:

- TypeORM only. The core is ORM-agnostic, so adapters for other ORMs can follow.
- PostgreSQL is fully supported. MySQL support is a preview: data-loss and deploy-safety rules
  apply, locking rules do not. It needs `npm install --save-dev node-sql-parser`.
- Only `up()` is checked, not `down()`.
- SQL built at run time is reported, not analyzed.
- GitHub annotations and SARIF output are planned for 0.2.0.

## Programmatic use

```ts
import { formatJson, lint } from 'orm-preflight'

const result = await lint({ cwd: process.cwd(), patterns: ['src/migrations/*.ts'] })
process.stdout.write(formatJson(result))
if (result.summary.errors > 0) process.exitCode = 1
```

## Contributing

See [CONTRIBUTING.md](https://github.com/sikandar100/orm-preflight/blob/main/CONTRIBUTING.md). To
report a security issue, see
[SECURITY.md](https://github.com/sikandar100/orm-preflight/blob/main/SECURITY.md).

## Acknowledgements

orm-preflight is inspired by [strong_migrations](https://github.com/ankane/strong_migrations)
for Rails and [squawk](https://github.com/sbdchd/squawk) for PostgreSQL.

## License

[MIT](https://github.com/sikandar100/orm-preflight/blob/main/LICENSE)
