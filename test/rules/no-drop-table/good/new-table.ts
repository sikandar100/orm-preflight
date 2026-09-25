import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropNewTable1727500000033 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "tmp" ("id" int)`)
    await queryRunner.query(`DROP TABLE "tmp"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
