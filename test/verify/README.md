# Lock verification

The locking rules make claims about PostgreSQL:

- which lock a statement takes
- whether it rewrites the table
- which statements fail inside a transaction

This folder checks every one of those claims against a real PostgreSQL server in Docker.

## How to run it

Check one version:

```sh
test/verify/check.sh 16
```

`check.sh` runs `verify-locks.sh` and compares its output with `expected.txt`. It fails with
a diff when any claim does not hold. Checks marked `(18+)` only run on PostgreSQL 18 and newer.

The same check runs in GitHub Actions on PostgreSQL 14, 15, 16, 17, and 18, on every push to
`main` and every night (`.github/workflows/verify.yml`).

## What the script does

For each statement, `verify-locks.sh` runs it inside a transaction on a table with 1,000 rows
and prints:

- the locks the transaction holds on each table (from `pg_locks`)
- `REWRITE` when the table's file node changed, which means PostgreSQL rewrote it

Some statements cannot run inside a transaction, such as `VACUUM FULL`. For those, a second
session holds a light lock on the table, and the script prints the lock the statement waits for.

Last, it runs the statements that must fail and prints their errors.

## Results

`results/` keeps the full output for PostgreSQL 14.24, 15.19, 16.15, 17.11, and 18.6, recorded
in September 2026. All five versions give the same result for every claim.

PostgreSQL 18 also shows two things older versions cannot do: `ADD CONSTRAINT ... NOT NULL ...
NOT VALID` needs no scan, and validating it takes only a SHARE UPDATE EXCLUSIVE lock. That is
the safe path `no-set-not-null` suggests on 18.

| Claim                                                                         | Rule                                  |
| ----------------------------------------------------------------------------- | ------------------------------------- |
| `CREATE INDEX` takes a SHARE lock, which blocks writes                        | `require-concurrent-index`            |
| `CONCURRENTLY` fails inside a transaction and in a multi-statement query      | `concurrent-index-transaction`        |
| A NOT NULL column without a default fails when rows exist                     | `no-add-not-null-without-default`     |
| Volatile defaults, serial, identity, and stored generated columns rewrite     | `no-volatile-default`                 |
| A constant default and `now()` do not rewrite                                 | `no-volatile-default`                 |
| Longer varchar, varchar to text, and varchar to unbounded do not rewrite      | `no-unsafe-column-type-change`        |
| Shorter varchar and int to bigint rewrite                                     | `no-unsafe-column-type-change`        |
| A foreign key locks both tables; `VALIDATE` takes SHARE UPDATE EXCLUSIVE      | `require-not-valid-foreign-key`       |
| `SET NOT NULL` takes ACCESS EXCLUSIVE and skips the scan with a valid CHECK   | `no-set-not-null`                     |
| `ADD CHECK` takes ACCESS EXCLUSIVE; `VALIDATE` takes SHARE UPDATE EXCLUSIVE   | `require-not-valid-check`             |
| `ADD UNIQUE` builds its index under ACCESS EXCLUSIVE; `USING INDEX` does not  | `require-concurrent-unique`           |
| `DROP INDEX` takes ACCESS EXCLUSIVE; `CONCURRENTLY` blocks no reads or writes | `require-concurrent-index-drop`       |
| `VACUUM FULL` and `CLUSTER` take ACCESS EXCLUSIVE; `REINDEX` takes SHARE      | `no-blocking-maintenance`             |
| `VACUUM` cannot run inside a transaction                                      | `no-blocking-maintenance`             |
| A new enum value cannot be used before its transaction commits                | `enum-value-used-in-same-transaction` |
| A waiting ALTER queues a plain SELECT behind it; `lock_timeout` cancels it    | `require-lock-timeout`                |
| TypeORM's enum recreate rewrites the table and fails on removed values        | `typeorm/no-enum-recreate`            |

## When to update

- A rule's claim changes: update `verify-locks.sh`, run `check.sh`, and update `expected.txt`.
- A new PostgreSQL major version comes out: add it to the workflow's matrix and record its
  results in `results/`.
