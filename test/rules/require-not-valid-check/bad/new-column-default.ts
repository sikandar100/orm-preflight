import { MigrationInterface, QueryRunner } from 'typeorm'

// The new column has a default, so every row holds a value and the check reads them all.
// Still an error.
export class AddScore1727500000414 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "score" integer DEFAULT 0`)
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "CHK_score" CHECK ("score" > 0)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
