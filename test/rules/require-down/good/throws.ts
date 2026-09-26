import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropLegacy1727500000505 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "legacy"`)
  }

  public async down(): Promise<void> {
    throw new Error('Irreversible: the legacy table and its rows are gone.')
  }
}
