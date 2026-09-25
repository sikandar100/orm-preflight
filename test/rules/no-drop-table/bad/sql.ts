import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropTableSql1727500000031 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "old_audit"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
