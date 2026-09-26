import { MigrationInterface, QueryRunner } from 'typeorm'

export class RecreateOnNewTable1727500000514 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "tickets" ("id" int, "state" text)`)
    await queryRunner.query(`ALTER TYPE "public"."ticket_state_enum" RENAME TO "ticket_state_enum_old"`)
    await queryRunner.query(`CREATE TYPE "public"."ticket_state_enum" AS ENUM('new', 'done')`)
    await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "state" TYPE "public"."ticket_state_enum" USING "state"::"text"::"public"."ticket_state_enum"`)
    await queryRunner.query(`DROP TYPE "public"."ticket_state_enum_old"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
