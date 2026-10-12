import { MigrationInterface, QueryRunner } from 'typeorm'

// The constraint was added NOT VALID by an earlier, already deployed migration.
export class ValidateAgeCheck1727600000601 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" VALIDATE CONSTRAINT "CHK_age"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
