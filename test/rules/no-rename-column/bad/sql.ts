import { MigrationInterface, QueryRunner } from 'typeorm'

export class RenameColumnSql1727500000051 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "age" TO "years"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
