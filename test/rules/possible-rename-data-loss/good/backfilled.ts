import { MigrationInterface, QueryRunner } from 'typeorm'

export class Backfilled1727500000025 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "assets" ADD COLUMN "stackId" uuid`)
    await queryRunner.query(`UPDATE "assets" SET "stackId" = "stackParentId"`)
    await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "stackParentId"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
