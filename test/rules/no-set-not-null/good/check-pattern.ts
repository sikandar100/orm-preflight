import { MigrationInterface, QueryRunner } from 'typeorm'

export class SetNotNullSafely1727500000164 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "users_email_not_null"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
