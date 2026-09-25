import { MigrationInterface, QueryRunner } from 'typeorm'
import { NAME } from './names'

export class DynamicName1727500000193 implements MigrationInterface {
  name = NAME

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SELECT 1`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
