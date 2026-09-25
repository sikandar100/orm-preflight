import { MigrationInterface, QueryRunner } from 'typeorm'

export class Consolidation1727500000026 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "name" character varying NOT NULL DEFAULT ''`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "firstName"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastName"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
