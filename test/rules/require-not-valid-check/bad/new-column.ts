import { MigrationInterface, QueryRunner } from 'typeorm'

// The check reads only a column added just before it: every row has NULL there, so the check
// cannot fail. Reported as info.
export class AddHolidayEnd1727500000411 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "holidays" ADD "end_date" date`)
    await queryRunner.query(
      `ALTER TABLE "holidays" ADD CONSTRAINT "CHK_end" CHECK ("end_date" IS NULL OR "end_date" >= "start_date")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
