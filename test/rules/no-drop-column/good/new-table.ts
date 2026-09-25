import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropColumnNewTable1727500000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "drafts" ("id" int, "tmp" int)`)
    await queryRunner.query(`ALTER TABLE "drafts" DROP COLUMN "tmp"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
