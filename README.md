# orm-preflight

[![npm](https://img.shields.io/npm/v/orm-preflight)](https://www.npmjs.com/package/orm-preflight)
[![CI](https://github.com/sikandar100/orm-preflight/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/sikandar100/orm-preflight/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/sikandar100/orm-preflight/badge)](https://scorecard.dev/viewer/?uri=github.com/sikandar100/orm-preflight)
[![License: MIT](https://img.shields.io/npm/l/orm-preflight)](https://github.com/sikandar100/orm-preflight/blob/main/LICENSE)

Preflight safety checks for TypeORM migrations: catch data loss and locking before you merge.

Documentation: https://sikandar100.github.io/orm-preflight/

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

| Rule                                                                                                                                                    | Reports                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Data loss**                                                                                                                                           |                                                                                       |
| [`no-drop-and-recreate-column`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-drop-and-recreate-column.md)                       | A column dropped and added again in one migration                                     |
| [`possible-rename-data-loss`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/possible-rename-data-loss.md)                           | One column dropped and another added, with no data copied (warning)                   |
| [`no-drop-column`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-drop-column.md)                                                 | A dropped column                                                                      |
| [`no-drop-table`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-drop-table.md)                                                   | A dropped table                                                                       |
| [`no-truncate`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-truncate.md)                                                       | `TRUNCATE` or `clearTable()`                                                          |
| [`typeorm/no-changecolumn-recreate`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/typeorm/no-changecolumn-recreate.md)             | `changeColumn()` that drops and re-adds the column                                    |
| **Deploy safety**                                                                                                                                       |                                                                                       |
| [`no-rename-column`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-rename-column.md)                                             | A renamed column                                                                      |
| [`no-rename-table`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-rename-table.md)                                               | A renamed table                                                                       |
| **Locking (PostgreSQL)**                                                                                                                                |                                                                                       |
| [`require-concurrent-index`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/require-concurrent-index.md)                             | `CREATE INDEX` without `CONCURRENTLY`                                                 |
| [`concurrent-index-transaction`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/concurrent-index-transaction.md)                     | `CONCURRENTLY` where it runs inside a transaction                                     |
| [`no-add-not-null-without-default`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-add-not-null-without-default.md)               | A `NOT NULL` column added without a default                                           |
| [`no-volatile-default`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-volatile-default.md)                                       | A column added with a volatile default, or as serial, identity, or generated          |
| [`no-unsafe-column-type-change`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-unsafe-column-type-change.md)                     | A column type change that rewrites the table                                          |
| [`require-not-valid-foreign-key`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/require-not-valid-foreign-key.md)                   | A foreign key added without `NOT VALID`                                               |
| [`no-set-not-null`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-set-not-null.md)                                               | `SET NOT NULL` on an existing column                                                  |
| [`require-not-valid-check`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/require-not-valid-check.md)                               | A CHECK constraint added without `NOT VALID`                                          |
| [`require-concurrent-unique`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/require-concurrent-unique.md)                           | A unique constraint or primary key added in place                                     |
| [`require-concurrent-index-drop`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/require-concurrent-index-drop.md)                   | `DROP INDEX` without `CONCURRENTLY` (warning)                                         |
| [`no-blocking-maintenance`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-blocking-maintenance.md)                               | `VACUUM FULL`, `CLUSTER`, or `REINDEX` without `CONCURRENTLY`                         |
| [`enum-value-used-in-same-transaction`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/enum-value-used-in-same-transaction.md)       | A new enum value used before the transaction that adds it commits                     |
| [`require-lock-timeout`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/require-lock-timeout.md)                                     | A change to an existing table without `lock_timeout` (off, opt-in)                    |
| [`typeorm/no-enum-recreate`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/typeorm/no-enum-recreate.md)                             | TypeORM 0.3's enum change by recreating the type (warning)                            |
| **Correctness**                                                                                                                                         |                                                                                       |
| [`typeorm/transaction-override-forbidden`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/typeorm/transaction-override-forbidden.md) | `transaction` set on a migration in transaction mode `"all"`                          |
| [`typeorm/invalid-migration-name`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/typeorm/invalid-migration-name.md)                 | A migration name without a 13-digit timestamp                                         |
| [`unanalyzable-statement`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/unanalyzable-statement.md)                                 | A statement orm-preflight could not read (warning)                                    |
| [`invalid-suppression`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/invalid-suppression.md)                                       | A suppression comment with no reason or an unknown rule                               |
| [`no-edit-applied-migration`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-edit-applied-migration.md)                           | With `--changed-since`: an edit to a migration that already exists on the base branch |
| [`require-down`](https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/require-down.md)                                                     | An empty or missing `down()` (warning)                                                |

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
  --format <format>           pretty, json, github (annotations), or sarif. Default:
                              github in GitHub Actions, pretty elsewhere
  --max-warnings <n>          Fail when there are more than n warnings (default: no limit)
  --execute                   Run each migration's up() to see SQL built at run time. This
                              runs your code: only use it on code you trust
  --allow-untrusted-execute   Allow --execute under GitHub's pull_request_target event
  --no-color                  Print without colors

orm-preflight rules                      List every rule
orm-preflight explain <rule>             Print a rule's documentation
orm-preflight init [files or globs...]   Write a starter config
orm-preflight mcp                        Run as an MCP server for AI coding agents
```

| Exit code | Meaning                                               |
| --------- | ----------------------------------------------------- |
| `0`       | No errors, and no more warnings than `--max-warnings` |
| `1`       | Errors, or more warnings than `--max-warnings`        |
| `2`       | Usage, config, or internal error                      |

| Format   | Output                                                                                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pretty` | Findings grouped by file, for people. Suppressed findings are only counted.                                                                                                        |
| `json`   | Every finding, including suppressed ones. The shape is public API, described in [docs/json-output.md](https://github.com/sikandar100/orm-preflight/blob/main/docs/json-output.md). |
| `github` | GitHub Actions annotations on the exact lines of the pull request, then a summary line.                                                                                            |
| `sarif`  | SARIF 2.1.0, for GitHub code scanning and other SARIF viewers. Suppressed findings are kept with their reason.                                                                     |

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

orm-preflight needs no database and no secrets, so it is safe on pull requests from forks.

### GitHub Action

Findings appear as annotations on the exact lines of the pull request:

```yaml
name: Migrations
on: pull_request

permissions:
  contents: read

jobs:
  orm-preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0 # for changed-since
          persist-credentials: false
      - uses: sikandar100/orm-preflight@v1
        with:
          changed-since: origin/${{ github.base_ref }}
```

Which version to use:

- `@v1` follows every 1.x release, so you get fixes without changing anything.
- `@v1.0.0`, or a commit SHA, stays exactly where it is, if your policy requires pinning.

The action installs the orm-preflight version of its tag with npm and runs it, so
GitHub-hosted runners need nothing else. On a self-hosted runner, set up Node.js 20 or newer
first.

| Input               | Meaning                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `changed-since`     | Check only migrations added or changed since the merge base with this git ref.                   |
| `files`             | Files or globs to check, separated by spaces. Default: the config, or every `migrations` folder. |
| `config`            | Path of the config file.                                                                         |
| `working-directory` | Directory to run in, relative to the repository root. Default `.`.                               |
| `max-warnings`      | Fail when there are more than this many warnings.                                                |
| `mysql`             | `true` when the migrations target MySQL, to install the MySQL parser.                            |
| `sarif`             | `true` to also upload the findings to GitHub code scanning. See below.                           |
| `version`           | The orm-preflight version to run. Default: the version of the action's tag.                      |

Use the `pull_request` trigger. Never use `pull_request_target` for this: it gives pull requests
from forks a token with write access and your secrets, and orm-preflight needs neither.

GitHub shows at most 10 annotations of each level per step. The last line of the log always
counts every finding.

To see findings in the repository's code scanning alerts as well, set `sarif: true` and grant
`security-events: write`. GitHub never grants that to pull requests from forks, so the action
skips the upload there and still annotates:

```yaml
permissions:
  contents: read
  security-events: write
```

### Other CI systems

Run the CLI. The exit code is 1 when there are errors:

```sh
npx orm-preflight --changed-since origin/main
```

Check out enough history for the merge base (in GitHub Actions, `fetch-depth: 0`).

## Use it from an AI coding agent

AI coding agents write migrations fast, and they can write the dangerous ones too. With
orm-preflight connected, the agent checks each migration it writes and fixes what it finds,
before you review anything.

### Claude Code plugin

The plugin does the most for you. Install it once, inside Claude Code:

```
/plugin marketplace add sikandar100/orm-preflight
/plugin install orm-preflight@orm-preflight
```

It adds three things:

- **An automatic check.** Every time Claude writes or edits a migration, orm-preflight checks it
  and hands the result straight back to Claude. Claude then fixes the migration, or tells you why
  it is safe. You do not have to read any warnings yourself. Other files are skipped instantly.
- **A skill** that teaches Claude the safe ways to change a schema, such as changing a column in
  place instead of dropping it.
- **The MCP tools** described below.

The plugin uses the orm-preflight installed in your project when there is one, so your config
and version apply. Otherwise it runs the version it was released with.

### Any agent, with MCP

`orm-preflight mcp` runs orm-preflight as an [MCP](https://modelcontextprotocol.io) server.
MCP is the standard way to give an agent new tools. Add it once.

In Claude Code, without the plugin:

```sh
claude mcp add orm-preflight -- npx -y orm-preflight mcp
```

In other agents, such as Cursor, VS Code, Codex, or Gemini CLI, add a server to the MCP
settings that runs this command. Each app has its own settings file, but the command is always
the same:

```sh
npx -y orm-preflight mcp
```

The exact setup for each agent, and an instructions snippet for `AGENTS.md`, are in
[Use with AI agents](https://sikandar100.github.io/orm-preflight/agents).

The agent gets three tools:

| Tool               | What the agent gets                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check_migrations` | The findings for some files, the whole project, or the migrations changed since a git ref such as `origin/main`. Each finding has what happens, why, and the safe way to do it. |
| `explain_rule`     | A rule's full documentation.                                                                                                                                                    |
| `list_rules`       | Every rule with its category and default severity.                                                                                                                              |

Good to know:

- The tools only read files. They never run a migration or connect to a database, and
  `--execute` is not available through MCP.
- The server checks the project it was started in. An agent that starts it somewhere else
  can pass `projectDir`.
- Flags after `mcp` set the defaults, for example `npx -y orm-preflight mcp --dialect mysql`.
  For MySQL, install `orm-preflight` and `node-sql-parser` in the project and use
  `npx orm-preflight mcp` without `-y`, so the parser is found.
- The server tells the agent never to add a suppression comment without asking you first.
- Your agent may ask you once to allow the tools.

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

### Running migrations with `--execute`

Some migrations build their SQL at run time, for example in a loop over table names, or in a
helper imported from another file. Static analysis cannot read that SQL. `--execute` can:

```sh
npx orm-preflight --execute
```

It loads each migration file and runs `up()` with a stand-in for TypeORM's query runner, which
records every statement instead of sending it to a database. So:

- No database is needed, and none is touched.
- Imports of `typeorm` get a small stand-in; the real TypeORM is never loaded.
- If `up()` reads the database, for example with `getTable()`, it gets an empty answer, and
  orm-preflight reports that a real database may lead to different statements.
- If `up()` fails or runs longer than 10 seconds, that is reported, and linting goes on.

**`--execute` runs your code.** Only use it on code you trust:

- Never use it on pull requests from forks with the `pull_request_target` trigger, which gives
  them your secrets. orm-preflight refuses to, unless you add `--allow-untrusted-execute`.
- The GitHub Action never uses `--execute`. It stays static and safe for forks.

## What a clean run means

A clean run means none of the documented hazards were found. It does not guarantee that a
migration is safe. orm-preflight does not know your table sizes or traffic, so it assumes every
existing table is large and busy.

Limitations:

- TypeORM only. The core is ORM-agnostic, so adapters for other ORMs can follow.
- PostgreSQL and MySQL. On MySQL, the data-loss, deploy-safety, and correctness rules apply.
  Locking analysis for MySQL (`ALGORITHM=INSTANT`, `INPLACE`, `COPY`) is planned after 1.0.
  MySQL needs `npm install --save-dev node-sql-parser`.
- Only `up()` is analyzed. `down()` is only checked for being empty (`require-down`).
- SQL built at run time is reported, not analyzed, unless you use `--execute`.

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
