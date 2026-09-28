import { MigrationInterface, QueryRunner } from 'typeorm'

export class Suppressed1727000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'users'
    // preflight safety-assured no-drop-column -- bio was removed from the entity in 2.3
    await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "bio"`)
  }

  public async down(): Promise<void> {
    throw new Error('irreversible')
  }
}
