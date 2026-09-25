import { MigrationInterface, QueryRunner } from 'typeorm'

export class VolatileDefault1727500000131 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "token" uuid NOT NULL DEFAULT gen_random_uuid()`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
