import { MigrationInterface, QueryRunner } from 'typeorm'

// round() drops the fractional digits beyond the ones it keeps.
export class RoundPrice1727500000704 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "price" TYPE integer USING round("price")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
