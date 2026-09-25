import { MigrationInterface, QueryRunner } from 'typeorm'

export class Broken1727200000070 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 1'
  }
}
