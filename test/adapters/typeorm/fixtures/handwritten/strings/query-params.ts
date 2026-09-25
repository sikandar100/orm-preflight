import { MigrationInterface, QueryRunner } from 'typeorm'

export class QueryParams1727200000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "users" SET "status" = $1 WHERE "status" IS NULL`, ['active'])
    await queryRunner.query('DELETE FROM "sessions" WHERE "expires" < $1', [new Date()])
  }

  public async down(): Promise<void> {}
}
