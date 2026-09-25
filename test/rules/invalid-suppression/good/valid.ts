import { MigrationInterface, QueryRunner } from 'typeorm'

export class ValidSuppression1727500000083 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // preflight safety-assured no-drop-column -- the column was never read in production
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "a"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
