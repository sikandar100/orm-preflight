import { MigrationInterface, QueryRunner } from 'typeorm'

export class DroppedFirst1727500000027 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "stackParentId"`)
    await queryRunner.query(`ALTER TABLE "assets" ADD COLUMN "stackId" uuid`)
    await queryRunner.query(`UPDATE "assets" SET "stackId" = gen_random_uuid()`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
