import { MigrationInterface, QueryRunner } from 'typeorm'

// left() keeps the first 5 characters and drops the rest of every longer value.
export class ShortenCode1727500000701 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "code" TYPE varchar(5) USING left("code", 5)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
