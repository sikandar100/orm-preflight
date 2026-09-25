import { MigrationInterface, QueryRunner } from 'typeorm'

export class ValidateThenSet1727500000165 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" VALIDATE CONSTRAINT "users_email_not_null"`)
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
