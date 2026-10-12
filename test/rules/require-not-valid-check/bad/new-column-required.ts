import { MigrationInterface, QueryRunner } from 'typeorm'

// The check requires the new column, which is NULL in every row: it fails on any existing
// row. Still an error.
export class RequireHolidayEnd1727500000412 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "holidays" ADD "end_date" date`)
    await queryRunner.query(
      `ALTER TABLE "holidays" ADD CONSTRAINT "CHK_end" CHECK ("end_date" IS NOT NULL)`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
