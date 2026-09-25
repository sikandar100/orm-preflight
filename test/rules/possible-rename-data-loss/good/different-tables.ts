import { MigrationInterface, QueryRunner } from 'typeorm'

export class DifferentTables1727500000024 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "age"`)
    await queryRunner.query(`ALTER TABLE "accounts" ADD "years" integer`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
