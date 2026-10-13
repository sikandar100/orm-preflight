import { MigrationInterface, QueryRunner } from 'typeorm'

// Inserting fixed rows rewrites nothing.
export class InsertValues1727600000821 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`INSERT INTO "settings" ("key") VALUES ('theme')`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
