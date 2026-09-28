import { MigrationInterface, QueryRunner } from 'typeorm'

export class Hangs1727000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" text`)
    await new Promise(() => {})
  }

  public async down(): Promise<void> {
    throw new Error('irreversible')
  }
}
