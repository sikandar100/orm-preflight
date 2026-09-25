import { MigrationInterface, QueryRunner } from 'typeorm'

export class IndexNewTable1727500000104 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "notes" ("id" int, "body" text)`)
    await queryRunner.query(`CREATE INDEX "IDX_notes_body" ON "notes" ("body")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
