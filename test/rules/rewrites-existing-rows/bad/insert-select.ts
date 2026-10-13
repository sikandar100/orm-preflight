import { MigrationInterface, QueryRunner } from 'typeorm'

// Copies rows from another table.
export class CopyRows1727500000823 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`INSERT INTO "users_history" ("id", "name") SELECT "id", "name" FROM "users"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
