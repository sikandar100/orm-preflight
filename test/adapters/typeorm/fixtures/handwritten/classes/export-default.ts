import { MigrationInterface, QueryRunner } from 'typeorm'

export default class ExportDefault1727200000033 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 1 AS default_export')
  }

  public async down(): Promise<void> {}
}
