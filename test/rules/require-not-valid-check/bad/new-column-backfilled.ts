import { MigrationInterface, QueryRunner } from 'typeorm'

// The new column is filled before the check is added, so its rows are no longer NULL and the
// check really reads them. Still an error.
export class BackfillHolidayEnd1727500000413 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "holidays" ADD "end_date" date`)
    await queryRunner.query(`UPDATE "holidays" SET "end_date" = "start_date"`)
    await queryRunner.query(
      `ALTER TABLE "holidays" ADD CONSTRAINT "CHK_end" CHECK ("end_date" >= "start_date")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
