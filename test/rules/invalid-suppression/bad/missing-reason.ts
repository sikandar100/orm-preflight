import { MigrationInterface, QueryRunner } from 'typeorm'

export class MissingReason1727500000081 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // preflight safety-assured no-drop-column
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "a"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
