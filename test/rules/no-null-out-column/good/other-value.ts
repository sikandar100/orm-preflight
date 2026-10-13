import { MigrationInterface, QueryRunner } from 'typeorm'

// Sets a value, not NULL.
export class SetValue1727600000811 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "users" SET "status" = 'active' WHERE "status" IS NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
