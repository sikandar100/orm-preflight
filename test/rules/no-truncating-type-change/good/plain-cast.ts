import { MigrationInterface, QueryRunner } from 'typeorm'

// A cast that keeps every value.
export class WidenAge1727600000702 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "age" TYPE bigint USING "age"::bigint`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
