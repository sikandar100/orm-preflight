import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropColumnSql1727500000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "legacy_email"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
