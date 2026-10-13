import { MigrationInterface, QueryRunner } from 'typeorm'

// Inserting rows deletes nothing.
export class InsertOnly1727600000802 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`INSERT INTO "settings" ("key") VALUES ('theme')`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
