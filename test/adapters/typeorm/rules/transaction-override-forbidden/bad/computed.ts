import { MigrationInterface, QueryRunner } from 'typeorm'

export class OverrideComputed1727500000182 implements MigrationInterface {
  transaction = process.env.TX === "1"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SELECT 1`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
