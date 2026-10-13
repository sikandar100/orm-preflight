import { MigrationInterface, QueryRunner } from 'typeorm'

// A table created in the same migration has no rows to lose.
export class DeleteNewTable1727600000801 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "staging" ("id" int)`)
    await queryRunner.query(`DELETE FROM "staging"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
