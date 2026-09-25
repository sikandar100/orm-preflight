import { MigrationInterface, QueryRunner } from 'typeorm'

export class EnumRecreate1727500000142 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" TYPE "public"."users_status_enum" USING "status"::"text"::"public"."users_status_enum"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
