import { MigrationInterface, QueryRunner } from 'typeorm'

// COMMIT ends the transaction that added the constraint, so VALIDATE runs in a new one.
export class ValidateAfterCommit1727600000602 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_age" CHECK ("age" >= 0) NOT VALID`,
    )
    await queryRunner.commitTransaction()
    await queryRunner.startTransaction()
    await queryRunner.query(`ALTER TABLE "users" VALIDATE CONSTRAINT "CHK_age"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
