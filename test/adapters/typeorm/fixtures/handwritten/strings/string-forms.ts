import { MigrationInterface, QueryRunner } from 'typeorm'

const TABLE = '"users"'
const DROP_NAME = `ALTER TABLE ${'"users"'} DROP COLUMN "name"`
const ADD_EMAIL = 'ALTER TABLE ' + TABLE + ' ADD "email" text'
const CHAINED = ADD_EMAIL

export class StringForms1727200000001 implements MigrationInterface {
  name = 'StringForms1727200000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" ADD "a" integer')
    await queryRunner.query("ALTER TABLE \"users\" ADD \"b\" integer")
    await queryRunner.query(`ALTER TABLE "users" ADD "c" integer`)
    await queryRunner.query(
      'ALTER TABLE "users" ' +
        'ADD "d" integer',
    )
    await queryRunner.query(ADD_EMAIL)
    await queryRunner.query(CHAINED)
    const local = `CREATE INDEX "IDX_a" ON "users" ("a")`
    await queryRunner.query(local)
    await queryRunner.query(`
      ALTER TABLE "users" ADD "e" integer;
      ALTER TABLE "users" ADD "f" integer;
    `)
    await queryRunner.query(DROP_NAME)
    await queryRunner.query(<string>'SELECT 1')
    await queryRunner.query(('SELECT 2' as string))
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "a"')
  }
}
