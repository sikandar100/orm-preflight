import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserBioDefault1727500000455 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
