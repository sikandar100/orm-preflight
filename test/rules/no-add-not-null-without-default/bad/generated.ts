import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddNotNullColumn1727500000121 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "nickname" character varying NOT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
