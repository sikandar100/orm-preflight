---
'orm-preflight': minor
---

First release. orm-preflight statically checks TypeORM migrations for data loss, locking, and rolling-deploy hazards before you merge, without running your code or connecting to a database.

- 19 rules, each with a documentation page that cites the PostgreSQL, MySQL, or TypeORM source behind it.
- Reads SQL in `queryRunner.query()` and `queryRunner` builder calls, including same-file helpers and branches on the database type.
- Config in `orm-preflight.config.json` or `package.json`, validated against the shipped `schema.json`.
- Suppression comments that require a reason.
- CLI with `pretty` and `json` output, `--max-warnings`, and the `rules`, `explain`, and `init` commands.
- PostgreSQL is fully supported. MySQL support is a preview.
