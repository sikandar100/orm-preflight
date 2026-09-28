import { MigrationInterface, QueryRunner } from 'typeorm'

throw new Error('cannot load')

export class LoadFails1727000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SELECT 1`)
  }

  public async down(): Promise<void> {
    throw new Error('irreversible')
  }
}
