import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddEnumValue1727500000511 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."users_status_enum" RENAME TO "users_status_enum_old"`)
    await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'inactive', 'banned')`)
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" TYPE "public"."users_status_enum" USING "status"::"text"::"public"."users_status_enum"`)
    await queryRunner.query(`DROP TYPE "public"."users_status_enum_old"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
