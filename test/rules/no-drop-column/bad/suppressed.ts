import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropColumnSuppressed1727500000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // preflight safety-assured no-drop-column -- removed from the entity in release 2.3, no reads since
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "legacy_email"`)
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "legacy_phone"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
