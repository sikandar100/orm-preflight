import { MigrationInterface, QueryRunner } from 'typeorm'

// A data correction on some rows.
export class FixTypo1727500000822 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "users" SET "status" = 'active' WHERE "status" = 'actve'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
