---
name: safe-migrations
description: Use when writing, generating, or changing a database migration, especially TypeORM migrations on PostgreSQL or MySQL. Explains how to check the migration with orm-preflight and the safe ways to make risky schema changes.
---

# Safe database migrations with orm-preflight

A migration that looks harmless can delete data or lock a busy table in production. It passes
every test on an empty database. orm-preflight catches these problems before the migration
runs.

## Every time you write or change a migration

1. Check it. The orm-preflight hook does this automatically after you write the file. You can
   also call the `check_migrations` tool, or run `npx orm-preflight <file>`.
2. Read each finding. It says what happens, why, and the safe way to do it.
3. Fix the migration the safe way, then check it again.
4. If a finding does not apply, explain why to the user. Do not hide it.

## Never silence a finding on your own

A comment like `// preflight safety-assured <rule> -- <reason>` turns a finding off. Only add
one when the user agrees, and write their real reason in it, such as "the table has 20 rows"
or "the column was removed from the entity in the last release". Never add one just to make
the check pass.

## Safe ways to make risky changes

| Change                           | The risk                                              | The safe way                                                                                                       |
| -------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Change a column's type or length | TypeORM may drop and re-add the column: all data lost | Write `ALTER COLUMN ... TYPE` yourself, or add a new column, copy the data, switch the code, then drop the old one |
| Rename a column or table         | Running app servers still use the old name            | Add the new column, write to both, switch reads, drop the old one in a later release                               |
| Drop a column                    | Old app versions still read it                        | Remove it from the entity and deploy first, drop it in a later release                                             |
| Create an index (PostgreSQL)     | Blocks writes while it builds                         | `CREATE INDEX CONCURRENTLY` in a migration with `transaction = false`                                              |
| Add a foreign key (PostgreSQL)   | Blocks writes to both tables while it checks each row | Add it `NOT VALID`, then `VALIDATE CONSTRAINT` in a separate migration                                             |
| Add a NOT NULL column            | Fails as soon as the table has rows                   | Add it nullable or with a default, backfill, then enforce NOT NULL                                                 |

With TypeORM, `transaction = false` on a migration also needs `migrationsTransactionMode: "each"`
in the DataSource, and the same in `orm-preflight.config.json`:
`{ "typeorm": { "transactionMode": "each" } }`.

## More help

- `explain_rule` (or `npx orm-preflight explain <rule>`) prints a rule's full documentation.
- Documentation: https://sikandar100.github.io/orm-preflight/
