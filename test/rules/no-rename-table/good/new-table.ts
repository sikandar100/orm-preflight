import { MigrationInterface, QueryRunner } from 'typeorm'

export class RenameNewTable1727500000064 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "drafts" ("a" int)`)
    await queryRunner.query(`ALTER TABLE "drafts" RENAME TO "notes"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
