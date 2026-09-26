// fixture: {"rules":{"require-lock-timeout":"warn"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class TimeoutTooLate1727500000453 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" text`)
    await queryRunner.query(`SET lock_timeout = '5s'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
