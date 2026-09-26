import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserAvatar1727500000502 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "avatar" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // TODO
  }
}
