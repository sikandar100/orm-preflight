import { MigrationInterface, QueryRunner } from 'typeorm'

// TypeORM runs migrations in one transaction by default, so VALIDATE runs while the lock
// from ADD CONSTRAINT ... NOT VALID is still held.
export class ValidateAgeCheck1727500000601 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_age" CHECK ("age" >= 0) NOT VALID`,
    )
    await queryRunner.query(`ALTER TABLE "users" VALIDATE CONSTRAINT "CHK_age"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
