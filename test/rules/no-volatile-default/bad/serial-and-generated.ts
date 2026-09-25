import { MigrationInterface, QueryRunner } from 'typeorm'

export class RewriteColumns1727500000132 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD "seq" serial`)
    await queryRunner.query(`ALTER TABLE "orders" ADD "total" numeric GENERATED ALWAYS AS ("price" * "qty") STORED`)
    await queryRunner.query(`ALTER TABLE "orders" ADD "num" int GENERATED ALWAYS AS IDENTITY`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
