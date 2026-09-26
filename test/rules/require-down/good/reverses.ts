import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserBioReversible1727500000504 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`)
  }
}
