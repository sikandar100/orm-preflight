import { MigrationInterface, QueryRunner } from 'typeorm'

export class Reads1727000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('users', 'legacy')) {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "legacy"`)
    }
  }

  public async down(): Promise<void> {
    throw new Error('irreversible')
  }
}
