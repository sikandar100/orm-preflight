import { MigrationInterface, QueryRunner } from 'typeorm'

// lower() changes values but keeps all of them.
export class LowerEmail1727600000703 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" TYPE text USING lower("email")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
