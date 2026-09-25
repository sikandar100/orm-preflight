import { MigrationInterface, QueryRunner } from 'typeorm'

export class RenameNewTable1727500000054 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "drafts" ("a" int)`)
    await queryRunner.query(`ALTER TABLE "drafts" RENAME COLUMN "a" TO "b"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
