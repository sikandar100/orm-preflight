import { MigrationInterface, QueryRunner } from 'typeorm'

// The foreign key uses only a column added just before it: every row has NULL there, and
// PostgreSQL does not check rows with a NULL foreign key. Reported as info.
export class AddApprover1727500000511 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "holidays" ADD "approver_id" integer`)
    await queryRunner.query(
      `ALTER TABLE "holidays" ADD CONSTRAINT "FK_approver" FOREIGN KEY ("approver_id") REFERENCES "users"("id")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
