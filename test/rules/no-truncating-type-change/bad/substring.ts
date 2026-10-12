import { MigrationInterface, QueryRunner } from 'typeorm'

// substring() keeps part of each value.
export class ShortenRef1727500000702 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "ref" TYPE varchar(8) USING substring("ref" from 1 for 8)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
