// fixture: {"$change":"added"}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserEmail1727000000303 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "email" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
