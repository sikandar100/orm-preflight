# orm-preflight

## 0.1.1

### Patch Changes

- [#9](https://github.com/sikandar100/orm-preflight/pull/9) [`ef90a7f`](https://github.com/sikandar100/orm-preflight/commit/ef90a7f4bbfa13c64d8b837589c1ab8227a2121e) Thanks [@sikandar100](https://github.com/sikandar100)! - The package now includes CHANGELOG.md.

## 0.1.0

### Minor Changes

- [#7](https://github.com/sikandar100/orm-preflight/pull/7) [`8ed6cd2`](https://github.com/sikandar100/orm-preflight/commit/8ed6cd2d8d18a197aa1b7ba6a4e39b9baf6939aa) Thanks [@sikandar100](https://github.com/sikandar100)! - First release. orm-preflight statically checks TypeORM migrations for data loss, locking, and rolling-deploy hazards before you merge, without running your code or connecting to a database.
  
  - 19 rules, each with a documentation page that cites the PostgreSQL, MySQL, or TypeORM source behind it.
  - Reads SQL in `queryRunner.query()` and `queryRunner` builder calls, including same-file helpers and branches on the database type.
  - Config in `orm-preflight.config.json` or `package.json`, validated against the shipped `schema.json`.
  - Suppression comments that require a reason.
  - CLI with `pretty` and `json` output, `--max-warnings`, and the `rules`, `explain`, and `init` commands.
  - PostgreSQL is fully supported. MySQL support is a preview.
