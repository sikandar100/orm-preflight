import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddArchivedStatus1727500000441 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."order_status_enum" ADD VALUE 'archived'`)
    await queryRunner.query(`UPDATE "orders" SET "status" = 'archived' WHERE "closedAt" < now() - interval '1 year'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
