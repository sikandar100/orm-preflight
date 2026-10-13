import { MigrationInterface, QueryRunner } from 'typeorm'

// Clears a column in every row.
export class ClearPhones1727500000811 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "users" SET "phone" = NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
