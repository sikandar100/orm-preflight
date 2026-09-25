import { MigrationInterface, QueryRunner } from 'typeorm'

export class DestructuredParam1727200000024 implements MigrationInterface {
  public async up({ query }: QueryRunner): Promise<void> {
    await query('SELECT 1')
  }

  public async down(): Promise<void> {}
}
