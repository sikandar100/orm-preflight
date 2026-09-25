# invalid-suppression

Reports a suppression comment that names no rule, an unknown rule, or gives no reason.

| Category    | Default severity | Databases         |
| ----------- | ---------------- | ----------------- |
| correctness | error            | PostgreSQL, MySQL |

## What happens

A suppression comment turns off one rule for the next statement, or for the whole file with the
`-file` form. Every suppression must name a known rule and give a reason, so that suppressions form
an audit trail. An invalid one suppresses nothing, and this rule reports it. For a misspelled rule
the message suggests the closest known rule ID.

The format is:

```ts
// preflight safety-assured <rule-id> -- <reason>
// preflight safety-assured-file <rule-id> -- <reason>
```

## Bad

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropUserBio1727300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // preflight safety-assured no-drop-colum
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## Safe

```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropUserBio1727300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // preflight safety-assured no-drop-column -- bio removed from the entity in 2.3, deployed everywhere
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ...
  }
}
```

## When to suppress

Never: fix the comment instead. A comment cannot suppress this rule, and a comment that tries is
reported too. To turn the rule off, change its severity in the config.

## References

None: this rule checks orm-preflight's own comments.
