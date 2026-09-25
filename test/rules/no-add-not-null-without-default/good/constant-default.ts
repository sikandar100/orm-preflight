import { MigrationInterface, QueryRunner } from 'typeorm'

export class NotNullWithDefault1727500000123 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "status" character varying NOT NULL DEFAULT 'active'`)
    await queryRunner.query(`ALTER TABLE "users" ADD "id2" bigint GENERATED ALWAYS AS IDENTITY`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
