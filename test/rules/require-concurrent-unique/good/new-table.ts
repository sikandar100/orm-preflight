import { MigrationInterface, QueryRunner } from 'typeorm'

export class NewTableUnique1727500000415 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "tags" ("id" int, "slug" text)`)
    await queryRunner.query(`ALTER TABLE "tags" ADD CONSTRAINT "UQ_tags_slug" UNIQUE ("slug")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
