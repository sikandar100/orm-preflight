import { writeFileSync } from 'node:fs'
import { MigrationInterface, QueryRunner } from 'typeorm'

// Loading this file leaves a mark, so a test can prove whether it was run.
if (process.env.ORM_PREFLIGHT_MARKER) writeFileSync(process.env.ORM_PREFLIGHT_MARKER, 'ran')

export class SideEffect1727000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SELECT 1`)
  }

  public async down(): Promise<void> {
    throw new Error('irreversible')
  }
}
