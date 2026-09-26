// fixture: {"rules":{"require-lock-timeout":"warn"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateNotes1727500000456 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "notes" ("id" int)`)
    await queryRunner.query(`CREATE INDEX "IDX_notes_id" ON "notes" ("id")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
