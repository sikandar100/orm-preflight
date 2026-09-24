# orm-preflight

Preflight safety checks for TypeORM migrations: catch data loss and locking before you merge.

> **Status: pre-alpha.** This package does not lint anything yet. The first usable release will be 0.1.0. Watch the repository to follow along.

## Why

Changing a column's length in TypeORM can delete all of its data. When a column's type or length changes, TypeORM's Postgres migration generator drops the column and adds it again ([typeorm/typeorm#3357](https://github.com/typeorm/typeorm/issues/3357)). The migration looks harmless in review and passes every test on an empty database.

Other migrations are safe for your data but take locks that block reads or writes for the length of a full table scan: a plain `CREATE INDEX`, adding a foreign key, `SET NOT NULL`, most column type changes. On a large table, that is an outage.

orm-preflight reads your migrations before they are merged and tells you what will happen, why, and how to do it safely.

## Planned features

- Static analysis: no database, no TypeORM runtime, no network, and no execution of your code. Safe to run on pull requests from forks.
- Checks for data loss, locking, and rolling-deploy hazards in both generated SQL and `queryRunner` builder calls.
- Every finding explains what happens, why, and the safe alternative, with a link to the PostgreSQL or MySQL documentation.
- Adoption on existing projects in minutes: ignore old migrations and lint only what changed.
- CI integration: exit codes, GitHub annotations, and SARIF.
- An ORM-agnostic core, so adapters for other ORMs can follow.

## What a clean run means

A clean run means none of the documented hazards were found. It does not guarantee that a migration is safe. orm-preflight does not know your table sizes or traffic, so it assumes every existing table is large and busy.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security issue, see [SECURITY.md](SECURITY.md).

## Acknowledgements

orm-preflight is inspired by [strong_migrations](https://github.com/ankane/strong_migrations) for Rails and [squawk](https://github.com/sbdchd/squawk) for PostgreSQL.

## License

[MIT](LICENSE)
