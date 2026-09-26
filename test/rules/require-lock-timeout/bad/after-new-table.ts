// fixture: {"rules":{"require-lock-timeout":"warn"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class NotesThenUsers1727500000452 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "notes" ("id" int)`)
    await queryRunner.query(`ALTER TABLE "notes" ADD "body" text`)
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
