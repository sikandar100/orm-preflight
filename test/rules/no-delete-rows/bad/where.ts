import { MigrationInterface, QueryRunner } from 'typeorm'

// Deletes the rows that match the WHERE.
export class DeleteSome1727500000802 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "users" WHERE "inactive" = true`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
