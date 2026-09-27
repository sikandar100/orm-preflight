# Lock verification

The locking rules make claims about PostgreSQL: which lock a statement takes, whether it
rewrites the table, and which statements fail inside a transaction. `verify-locks.sh` checks
each claim against a real server in Docker.

```sh
test/verify/verify-locks.sh 14
test/verify/verify-locks.sh 18
```

For each statement, the script runs it inside a transaction on a table with 1,000 rows and
prints:

- the locks the transaction holds on each table (from `pg_locks`)
- `REWRITE` when the table's file node changed, which means PostgreSQL rewrote it

It then runs the statements that must fail and prints the error.

## Results

`results/pg14.txt` and `results/pg18.txt` hold the output for PostgreSQL 14.24 and 18.6,
recorded on 26 and 27 September 2026. Both versions agree on every claim. PostgreSQL 18 also shows
that `ADD CONSTRAINT ... NOT NULL ... NOT VALID` needs no scan, and that validating it takes
only a SHARE UPDATE EXCLUSIVE lock, which is the safe path `no-set-not-null` suggests on 18.

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

Re-run the script and update the results when a rule's claim changes or a new PostgreSQL
major version is released.
