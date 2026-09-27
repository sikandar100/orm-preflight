# orm-preflight

## 0.2.0

### Minor Changes

- [#12](https://github.com/sikandar100/orm-preflight/pull/12) [`1c1171b`](https://github.com/sikandar100/orm-preflight/commit/1c1171b174fdf2a3db8611a02fdeff068e33e649) Thanks [@sikandar100](https://github.com/sikandar100)! - Add `--changed-since <git-ref>` to check only the migrations a branch adds or changes, and the `no-edit-applied-migration` rule (warn), which reports an edit to a migration that already exists on the base branch.

- [#16](https://github.com/sikandar100/orm-preflight/pull/16) [`a8cdff7`](https://github.com/sikandar100/orm-preflight/commit/a8cdff74eaa729c06de086f8ec46303f4b8c3ffd) Thanks [@sikandar100](https://github.com/sikandar100)! - Add `require-down` (warn), which reports an empty or missing `down()`, and `typeorm/no-enum-recreate` (warn), which reports TypeORM 0.3's enum change by recreating the type. MySQL is no longer a preview: the data-loss, deploy-safety, and correctness rules apply. Database-type checks now follow same-file helpers that receive the type as a parameter or return it.

- [#17](https://github.com/sikandar100/orm-preflight/pull/17) [`179b9aa`](https://github.com/sikandar100/orm-preflight/commit/179b9aa187b9792f973fef463392f30e6e5537f3) Thanks [@sikandar100](https://github.com/sikandar100)! - Add the GitHub Action (`uses: sikandar100/orm-preflight@v0.2.0`). It annotates pull requests, can upload SARIF to code scanning (skipped on forks), and needs no secrets.

- [#14](https://github.com/sikandar100/orm-preflight/pull/14) [`d489a58`](https://github.com/sikandar100/orm-preflight/commit/d489a58aefee985564a98652a334806fd0bf2288) Thanks [@sikandar100](https://github.com/sikandar100)! - Add the `github` output format, with annotations on the exact pull request lines, and the `sarif` format (SARIF 2.1.0) for GitHub code scanning. In GitHub Actions, `github` is the default.

- [#15](https://github.com/sikandar100/orm-preflight/pull/15) [`ba36e07`](https://github.com/sikandar100/orm-preflight/commit/ba36e079ffad6fe5896d8c003cec79418340e359) Thanks [@sikandar100](https://github.com/sikandar100)! - Add six PostgreSQL locking rules: `require-not-valid-check`, `require-concurrent-unique`, `require-concurrent-index-drop`, `no-blocking-maintenance`, and `enum-value-used-in-same-transaction` (warn), and the opt-in `require-lock-timeout` (off). `ALTER COLUMN ... SET DEFAULT` is now analyzed.

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
