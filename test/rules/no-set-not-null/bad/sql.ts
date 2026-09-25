import { MigrationInterface, QueryRunner } from 'typeorm'

export class SetNotNull1727500000161 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
