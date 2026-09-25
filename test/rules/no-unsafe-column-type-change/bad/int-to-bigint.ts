import { MigrationInterface, QueryRunner } from 'typeorm'

export class IntToBigint1727500000141 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "age" TYPE bigint`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
