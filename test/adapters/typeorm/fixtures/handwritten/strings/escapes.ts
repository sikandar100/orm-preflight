import { MigrationInterface, QueryRunner } from 'typeorm'

export class Escapes1727200000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`COMMENT ON COLUMN "users"."bio" IS 'uses \` and \${x} and \\ here'`)
    await queryRunner.query('ALTER TABLE "users" ADD "note" text DEFAULT E\'line\\nbreak\'')
    await queryRunner.query("SELECT '\u00e9t\u00e9', '\x41', '\u{1F600}' AS x")
    await queryRunner.query(`SELECT 1 \
AS continued`)
  }

  public async down(): Promise<void> {}
}
