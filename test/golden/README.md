# Golden migrations

These migrations were written by real `typeorm migration:generate`. They prove that
orm-preflight catches what TypeORM actually generates, not just what we expect it to.

Do not edit the migration files by hand.

## What is here

- `typeorm-0.3.31/` and `typeorm-1.1.1/`: one folder per TypeORM line.
- `postgres/` (PostgreSQL 16) and `mysql/` (MySQL 8.4) inside each.
- `expected.json`: the rules each migration must trigger.
- `golden.test.ts`: checks every migration against `expected.json`.

The test fails in both directions:

- a rule that is missing is a false negative
- a rule that is extra is a false positive

## The scenarios

| Scenario         | The change                                   |
| ---------------- | -------------------------------------------- |
| WidenVarchar     | `users.name` goes from 100 to 255 characters |
| IntToBigint      | `users.age` goes from `int` to `bigint`      |
| AddEnumValue     | `users.status` gains the value `banned`      |
| AddIndex         | a new index on `users.email`                 |
| AddRelation      | `posts.authorId` becomes a foreign key       |
| RenameProperty   | the property `age` is renamed to `years`     |
| AddNotNullColumn | a new required column `users.nickname`       |
| MakeRequired     | `users.bio` stops accepting NULL             |
| RemoveEnumValue  | `users.status` loses the value `inactive`    |
| RemoveColumn     | `users.legacyCode` is removed                |
| AddUnique        | `users.email` becomes unique                 |

## Known gap

On MySQL, TypeORM changes an enum with `CHANGE status status enum(...)`. The statement lists
only the new values, so orm-preflight cannot tell that a value was removed. Rows that hold the
removed value then fail, or are blanked. `expected.json` records this gap.

## How to regenerate

You need Docker and network access.

```sh
scripts/golden/generate.sh
```

The script starts PostgreSQL and MySQL in Docker, installs each TypeORM version in a temporary
folder, and generates every scenario. For each scenario it resets the database to the "before"
entities, then generates a migration from the "after" entities with a fixed timestamp.

The entities live in `scripts/golden/data-source.cjs`.

## When to regenerate

When a new TypeORM version comes out:

1. Update `typeorm_versions` in `scripts/golden/generate.sh`.
2. Run the script.
3. Review the diff. If TypeORM now writes different SQL, decide which rules should fire and
   update `expected.json`.
