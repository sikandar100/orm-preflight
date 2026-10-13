import { MigrationInterface, QueryRunner } from 'typeorm'

// Deletes every row of an existing table.
export class DeleteAll1727500000801 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "audit_log"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
