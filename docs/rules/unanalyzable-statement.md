# unanalyzable-statement

Warns about a statement orm-preflight could not read, so that nothing it cannot check passes silently.

| Category    | Default severity | Databases         |
| ----------- | ---------------- | ----------------- |
| correctness | warn             | PostgreSQL, MySQL |

## What happens

orm-preflight reads migrations without running them. When it cannot tell what a statement does, it
reports this warning instead of skipping it, because the statement may contain any of the hazards
the other rules check. The message says why. Common reasons:

- The SQL is built at run time, for example from a value read from the database, a function
  orm-preflight cannot follow, or a value imported from another file.
- `queryRunner` is passed to a helper imported from another file.
- A `queryRunner` method orm-preflight does not know, or builder arguments it cannot resolve.
- SQL the parser cannot read, or a file with a syntax error.
- A migration `name` that is not a constant, so its timestamp cannot be checked.

orm-preflight reads what it can work out from the migration file itself:

- string and template literals, and `+` concatenations of them
- `${...}` in a template, when its value is known: a `const` string, number, array, or object in
  the same file, a static property of the class, `.join()` and `.replace()` on known values, or a
  local function that returns a string
- a `for (const x of ...)` loop over a known array, which it reads once per item
- helpers in the same file: methods called through `this`, and local functions

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

import { TENANT_TABLES } from '../tenants'

export class AddTenantIndexes1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TENANT_TABLES) {
      await queryRunner.query(`CREATE INDEX ON ${table} ("tenantId")`)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

Write the statements out, so orm-preflight can check them:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddTenantIndexes1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_orders_tenant" ON "orders" ("tenantId")`)
    await queryRunner.query(`CREATE INDEX "IDX_invoices_tenant" ON "invoices" ("tenantId")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

Or keep the list in the migration file, so orm-preflight can read the loop once per table:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

const TENANT_TABLES = ['orders', 'invoices']

export class AddTenantIndexes1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TENANT_TABLES) {
      await queryRunner.query(`CREATE INDEX "IDX_${table}_tenant" ON "${table}" ("tenantId")`)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## When to suppress

When the SQL has to be dynamic. Check what it does by hand, and record that:

```ts
// preflight safety-assured unanalyzable-statement -- creates tenant indexes on new, empty tables only
```

To accept every unreadable statement in a file at once, use the file form anywhere in the file:

```ts
// preflight safety-assured-file unanalyzable-statement -- seed data built from fixtures, reviewed in #214
```

## References

None: this rule reports a limit of orm-preflight, not a database behavior.
