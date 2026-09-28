import { MigrationInterface, QueryRunner } from 'typeorm'

export class Throws1727000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" text`)
    throw new Error('boom')
  }

  public async down(): Promise<void> {
    throw new Error('irreversible')
  }
}
