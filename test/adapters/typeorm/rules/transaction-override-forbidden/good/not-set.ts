import { MigrationInterface, QueryRunner } from 'typeorm'

export class NoOverride1727500000184 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SELECT 1`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
