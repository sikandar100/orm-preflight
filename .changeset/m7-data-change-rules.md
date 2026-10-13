---
'orm-preflight': minor
---

Three rules for data changes in a migration, which are easy to miss in review:

- `no-delete-rows` (warning): a `DELETE` on an existing table. On PostgreSQL the finding quotes the `WHERE` condition, or says every row is deleted.
- `no-null-out-column` (warning): an `UPDATE` that only clears columns, setting them to `NULL`.
- `rewrites-existing-rows` (info): every `UPDATE`, `MERGE`, upsert, or `INSERT ... SELECT` on an existing table, with its `WHERE` condition, so a "nothing may lose data" release check can review them. It points out a whole-table `UPDATE` in one statement, and names columns an `UPDATE` clears while it changes others.
