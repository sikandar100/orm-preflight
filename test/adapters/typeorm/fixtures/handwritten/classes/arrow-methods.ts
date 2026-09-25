import { MigrationInterface, QueryRunner } from 'typeorm'

export class ArrowMethods1727200000041 implements MigrationInterface {
  up = async (queryRunner: QueryRunner): Promise<void> => {
    await queryRunner.query('SELECT 1 AS arrow_up')
  }

  down = async (queryRunner: QueryRunner): Promise<void> => queryRunner.query('SELECT 2')
}

export class FunctionProperty1727200000042 implements MigrationInterface {
  up = async function (queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 3 AS function_property')
  }

  async down(): Promise<void> {}
}
