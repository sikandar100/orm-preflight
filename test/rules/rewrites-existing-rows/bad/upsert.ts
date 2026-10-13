import { MigrationInterface, QueryRunner } from 'typeorm'

// May overwrite existing rows.
export class Upsert1727500000824 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`INSERT INTO "settings" ("key", "value") VALUES ('theme', 'dark') ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
