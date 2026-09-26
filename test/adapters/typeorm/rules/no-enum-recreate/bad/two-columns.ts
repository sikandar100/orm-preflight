import { MigrationInterface, QueryRunner } from 'typeorm'

export class RemoveEnumValue1727500000512 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."order_status_enum" RENAME TO "order_status_enum_old"`)
    await queryRunner.query(`CREATE TYPE "public"."order_status_enum" AS ENUM('open', 'closed')`)
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT`)
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" TYPE "public"."order_status_enum" USING "status"::"text"::"public"."order_status_enum"`)
    await queryRunner.query(`ALTER TABLE "archived_orders" ALTER COLUMN "status" TYPE "public"."order_status_enum" USING "status"::"text"::"public"."order_status_enum"`)
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'open'`)
    await queryRunner.query(`DROP TYPE "public"."order_status_enum_old"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
