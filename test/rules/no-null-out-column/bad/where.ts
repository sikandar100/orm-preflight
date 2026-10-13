import { MigrationInterface, QueryRunner } from 'typeorm'

// Clears two columns in some rows.
export class ClearSome1727500000812 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "users" SET "phone" = NULL, "fax" = NULL WHERE "country" = 'UK'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
