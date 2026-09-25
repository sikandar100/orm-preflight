import { MigrationInterface, QueryRunner } from 'typeorm'

declare const rows: { queryRunner: string }[]

export class ParamName1727200000023 implements MigrationInterface {
  public async up(qr: QueryRunner): Promise<void> {
    await qr.query('SELECT 1 AS custom_param_name')
    rows.forEach(({ queryRunner }) => queryRunner.toString())
    const inner = (qr: { query(sql: string): void }) => qr.query('SELECT 2 AS shadowed_not_extracted')
  }

  public async down(qr: QueryRunner): Promise<void> {}
}
