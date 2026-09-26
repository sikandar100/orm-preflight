// fixture: {"rules":{"require-lock-timeout":"warn"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserBio1727500000451 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" text`)
    await queryRunner.query(`ALTER TABLE "users" ADD "avatar" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
