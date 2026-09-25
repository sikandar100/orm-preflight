import { MigrationInterface, QueryRunner } from 'typeorm'

export class RenameTableSql1727500000061 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" RENAME TO "accounts"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
