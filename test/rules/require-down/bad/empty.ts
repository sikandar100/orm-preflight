import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserBio1727500000501 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
