import { MigrationInterface, QueryRunner } from 'typeorm'

export class UnknownRule1727500000082 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // preflight safety-assured no-drop-colum -- typo in the rule ID
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "a"`)
    // preflight safety-assured -- names no rule
    await queryRunner.query(`SELECT 1`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
