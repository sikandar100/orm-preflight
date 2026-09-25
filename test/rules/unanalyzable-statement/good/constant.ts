import { MigrationInterface, QueryRunner } from 'typeorm'

export class Constant1727500000074 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const sql = `ALTER TABLE "users" ADD "bio" text`
    await queryRunner.query(sql)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
