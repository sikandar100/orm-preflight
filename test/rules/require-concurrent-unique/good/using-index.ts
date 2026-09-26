import { MigrationInterface, QueryRunner } from 'typeorm'

export class AttachUnique1727500000414 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_users_email" UNIQUE USING INDEX "UQ_users_email_idx"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
