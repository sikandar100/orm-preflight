# no-truncating-type-change

Reports a column type change whose `USING` expression keeps only part of each value, such as `left()` or a cast to `varchar(n)`.

| Category  | Default severity | Databases  |
| --------- | ---------------- | ---------- |
| data-loss | warn             | PostgreSQL |

## What happens

`ALTER COLUMN ... TYPE ... USING <expression>` replaces every value with the result of the
expression. Some expressions drop part of a value, with no error:

- `left()`, `right()`, `substr()`, `substring()`, and `split_part()` keep some characters
- `round()`, `trunc()`, and `date_trunc()` drop digits or parts of a date
- an explicit cast to `varchar(n)` or `char(n)` cuts longer values to `n` characters

The dropped part is gone once the migration commits. Without `USING`, PostgreSQL behaves
differently: making a `varchar` shorter fails on the first value that is too long, so nothing is
lost.

The type change also rewrites the table under a lock, which
[no-unsafe-column-type-change](no-unsafe-column-type-change.md) reports.

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class ShortenUserCode1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "code" TYPE varchar(5) USING left("code", 5)`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

First check that no value would be cut:

```sql
SELECT count(*) FROM "users" WHERE "code" <> left("code", 5);
```

Then change the type without `USING`. PostgreSQL fails instead of cutting a value that does not
fit:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class ShortenUserCode1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "code" TYPE varchar(5)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

To keep the original values, add a new column with the new type, copy the values, switch the
code, and drop the old column in a later release.

## When to suppress

When cutting the values is the point, for example to drop a known suffix, and you have checked
which rows change.

```ts
// preflight safety-assured no-truncating-type-change -- codes were padded to 8 characters by the old importer; the last 3 are always spaces
```

## References

- PostgreSQL: [character types](https://www.postgresql.org/docs/current/datatype-character.html)
  ("if one explicitly casts a value to character varying(n) or character(n), then an over-length
  value will be truncated to n characters without raising an error")
- PostgreSQL: [string functions](https://www.postgresql.org/docs/current/functions-string.html)
  (`left`, `right`, `substr`, `substring`, `split_part`)
- PostgreSQL: [mathematical functions](https://www.postgresql.org/docs/current/functions-math.html)
  (`round`, `trunc`) and [date/time functions](https://www.postgresql.org/docs/current/functions-datetime.html#FUNCTIONS-DATETIME-TRUNC)
  (`date_trunc`)
- PostgreSQL: [ALTER TABLE, SET DATA TYPE](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-DESC-SET-DATA-TYPE)
  ("The optional USING clause specifies how to compute the new column value from the old")
- orm-preflight [verification results](https://github.com/sikandar100/orm-preflight/blob/main/test/verify/README.md)
  ("varchar(3) USING left(name, 3)" keeps "n10" of "n1000", and the plain change fails)
