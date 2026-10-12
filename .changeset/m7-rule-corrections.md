---
'orm-preflight': minor
---

Rule corrections from real use on a production TypeORM project.

- New `info` severity, for findings worth knowing that are not problems. Info findings never fail a run and do not count toward `--max-warnings`. The JSON output gains `"info"` as a severity and an `info` count in the summary. In SARIF they are notes, and in GitHub annotations notices.
- `require-not-valid-check` and `require-not-valid-foreign-key` report a constraint as `info` when it cannot fail: it only uses a column added earlier in the same migration, so every row has NULL there.
- New rule `validate-in-same-transaction` (warning): `VALIDATE CONSTRAINT` in the same transaction that added the constraint `NOT VALID` gains nothing, because the strong lock is held until the transaction commits.
- New rule `no-truncating-type-change` (warning): a type change whose `USING` keeps only part of each value, such as `left()`, `round()`, or a cast to `varchar(n)`, loses data without an error.
- The advice to validate a constraint "in a separate migration" now says when that helps: with TypeORM's default `migrationsTransactionMode: "all"`, every pending migration runs in one transaction, so deploy it in a later release, or use `"each"`.
- The MCP `explain_rule` tool points to `list_rules` instead of a command line hint.
