import { MigrationInterface, QueryRunner } from 'typeorm'

// Without USING, PostgreSQL fails on a value that is too long instead of cutting it.
export class NarrowCode1727600000701 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "code" TYPE varchar(5)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
