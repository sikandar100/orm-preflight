import { MigrationInterface, QueryRunner } from 'typeorm'

declare function addAuditColumns(queryRunner: QueryRunner): Promise<void>
declare class Seeder {
  constructor(queryRunner: QueryRunner)
}

export class Helpers1727200000021 implements MigrationInterface {
  private runner?: QueryRunner

  public async up(queryRunner: QueryRunner): Promise<void> {
    await addAuditColumns(queryRunner)
    await this.helper(queryRunner)
    new Seeder(queryRunner)
    const qr = queryRunner
    await qr.query('SELECT 1 AS through_alias')
    this.runner = queryRunner
    const { query } = queryRunner
    const bag = { runner: queryRunner }
    const list = [queryRunner]
    await queryRunner.query('SELECT 2 AS still_found')
  }

  private async helper(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 3 AS inside_helper')
  }

  public async down(): Promise<void> {}
}
