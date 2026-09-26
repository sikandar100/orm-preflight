import { MigrationInterface, QueryRunner } from 'typeorm'

export class DefaultArchived1727500000442 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "order_status_enum" ADD VALUE 'archived'`)
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'archived'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
