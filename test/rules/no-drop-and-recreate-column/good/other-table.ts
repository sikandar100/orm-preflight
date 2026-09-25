import { MigrationInterface, QueryRunner } from 'typeorm'

export class OtherTable1727500000014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "age"`)
    await queryRunner.query(`ALTER TABLE "accounts" ADD "age" integer`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
