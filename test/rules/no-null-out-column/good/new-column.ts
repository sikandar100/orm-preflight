import { MigrationInterface, QueryRunner } from 'typeorm'

// Rows of a new table hold nothing yet.
export class NewColumn1727600000812 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "drafts" ("id" int, "body" text)`)
    await queryRunner.query(`UPDATE "drafts" SET "body" = NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
