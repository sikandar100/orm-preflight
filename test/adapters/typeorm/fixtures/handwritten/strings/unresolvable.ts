import { MigrationInterface, QueryRunner } from 'typeorm'
import { SHARED_SQL } from './shared'

let mutable = 'ALTER TABLE "users" ADD "x" integer'
const MODULE_SQL = 'ALTER TABLE "users" ADD "shadowed" integer'

function buildSql(column: string): string {
  return `ALTER TABLE "users" ADD "${column}" integer`
}

export class Unresolvable1727200000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const column = 'y'
    await queryRunner.query(`ALTER TABLE "users" ADD "${column}" integer`)
    await queryRunner.query(mutable)
    await queryRunner.query(SHARED_SQL)
    await queryRunner.query(buildSql('z'))
    await queryRunner.query(this.sql)
    await queryRunner.query()
    await queryRunner.query('ALTER TABLE ' + 42)
    {
      let MODULE_SQL = 'SELECT 1'
      await queryRunner.query(MODULE_SQL)
    }
  }

  private sql = 'SELECT 1'

  public async down(): Promise<void> {}
}
