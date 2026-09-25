import { MigrationInterface, QueryRunner } from 'typeorm'

export class StableDefault1727500000134 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`)
    await queryRunner.query(`ALTER TABLE "users" ADD "token" uuid`)
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "token" SET DEFAULT gen_random_uuid()`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
