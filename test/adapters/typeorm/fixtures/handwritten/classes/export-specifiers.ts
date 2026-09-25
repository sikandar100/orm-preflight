import { MigrationInterface, QueryRunner } from 'typeorm'

class Specified1727200000034 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 1 AS export_specifier')
  }

  public async down(): Promise<void> {}
}

export const Expression1727200000035 = class implements MigrationInterface {
  name = 'Expression1727200000035'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 2 AS exported_class_expression')
  }

  public async down(): Promise<void> {}
}

export { Specified1727200000034 as Renamed }
export { Other } from './other'
