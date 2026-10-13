import { MigrationInterface, QueryRunner } from 'typeorm'

// A whole-table backfill in one statement.
export class Backfill1727500000821 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "users" SET "full_name" = "first_name" || ' ' || "last_name"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
