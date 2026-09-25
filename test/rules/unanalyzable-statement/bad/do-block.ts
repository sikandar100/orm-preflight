import { MigrationInterface, QueryRunner } from 'typeorm'

export class DoBlock1727500000072 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1) THEN ALTER TABLE "users" ADD "a" int; END IF; END $$`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
