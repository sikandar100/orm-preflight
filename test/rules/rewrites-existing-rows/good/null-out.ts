import { MigrationInterface, QueryRunner } from 'typeorm'

// Setting a column to NULL is reported by no-null-out-column instead.
export class NullOut1727600000823 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "users" SET "phone" = NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
