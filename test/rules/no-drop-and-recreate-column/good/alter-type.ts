import { MigrationInterface, QueryRunner } from 'typeorm'

export class AlterType1727500000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "name" TYPE character varying(255)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
