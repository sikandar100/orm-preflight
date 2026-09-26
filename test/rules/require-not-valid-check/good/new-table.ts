import { MigrationInterface, QueryRunner } from 'typeorm'

export class NewTableCheck1727500000404 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "scores" ("id" int, "points" int)`)
    await queryRunner.query(`ALTER TABLE "scores" ADD CONSTRAINT "CHK_points" CHECK ("points" >= 0)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
