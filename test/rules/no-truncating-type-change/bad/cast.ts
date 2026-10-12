import { MigrationInterface, QueryRunner } from 'typeorm'

// An explicit cast to varchar(n) cuts longer values short without an error.
export class ShortenName1727500000703 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "name" TYPE varchar(20) USING "name"::varchar(20)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
