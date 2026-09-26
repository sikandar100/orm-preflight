// fixture: {"$change":"modified"}
// preflight safety-assured-file no-edit-applied-migration -- this migration never left the feature branch
import { MigrationInterface, QueryRunner } from 'typeorm'

export class FixTypo1727000000305 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "email" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
