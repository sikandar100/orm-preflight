import { MigrationInterface, QueryRunner } from 'typeorm'

// The constraint validated here is not the one added in this migration.
export class ValidateOther1727600000604 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_new" CHECK ("age" >= 0) NOT VALID`,
    )
    await queryRunner.query(`ALTER TABLE "users" VALIDATE CONSTRAINT "CHK_old"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
