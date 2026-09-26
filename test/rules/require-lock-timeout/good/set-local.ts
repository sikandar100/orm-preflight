// fixture: {"rules":{"require-lock-timeout":"warn"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserBioSafely1727500000454 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`)
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
