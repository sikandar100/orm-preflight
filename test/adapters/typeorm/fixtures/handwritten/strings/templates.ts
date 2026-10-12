import { MigrationInterface, QueryRunner } from 'typeorm'
import { IMPORTED_TABLES } from './shared'

const ACTIVE = 1
const HISTORY_COLUMNS = `id, name, dml_status`
const ACTIVE_ROWS = `dml_status = ${ACTIVE}`

const RULES = [
  { table: 'leave_requests', column: 'status' },
  { table: 'timesheets', column: 'state' },
]

export class Templates1727200000010 implements MigrationInterface {
  static readonly TABLES = ['employees', 'teams'] as const
  static readonly COLUMNS = ['body', 'subject']

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Constants, including a number and a template built from another constant.
    await queryRunner.query(`INSERT INTO "history" (${HISTORY_COLUMNS}) SELECT ${HISTORY_COLUMNS} FROM "users" WHERE ${ACTIVE_ROWS}`)

    // A local arrow function whose body is a string, called with literal arguments.
    const shape = (table: string, column: string) => `CONSTRAINT ck_${table}_${column} CHECK (${column} > 0)`
    await queryRunner.query(`CREATE TABLE "amounts" ("value" integer, ${shape('amounts', 'value')})`)

    // .join() on a local array and on a static array of the class.
    const cols = ['a', 'b'].join(', ')
    await queryRunner.query(`SELECT ${cols}, ${Templates1727200000010.COLUMNS.join(', ')} FROM "users"`)

    // .replace() with plain strings.
    const predicate = 'x.dml_status = 1'
    await queryRunner.query(`SELECT 1 FROM "users" u WHERE ${predicate.replace('x.', 'u.')}`)

    // A loop over a static array of the class runs once per table.
    for (const table of Templates1727200000010.TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD "note" text`)
    }

    // A loop over a constant array of objects, with property reads.
    for (const rule of RULES) {
      await queryRunner.query(`CREATE INDEX "ix_${rule.table}" ON "${rule.table}" ("${rule.column}")`)
    }

    // Still unknown: a value read from the database, a loop that may stop early, an import.
    const live = await queryRunner.query(`SELECT string_agg(column_name, ', ') FROM information_schema.columns`)
    await queryRunner.query(`SELECT ${live} FROM "users"`)
    for (const table of Templates1727200000010.TABLES) {
      if (table === 'teams') break
      await queryRunner.query(`ALTER TABLE "${table}" ADD "flag" boolean`)
    }
    for (const table of IMPORTED_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD "flag" boolean`)
    }
  }

  public async down(): Promise<void> {}
}
