import { MigrationInterface, QueryRunner } from 'typeorm'

// Backfilling a table created in the same migration.
export class BackfillNew1727600000822 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "totals" ("id" int, "n" int)`)
    await queryRunner.query(`UPDATE "totals" SET "n" = 0`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
