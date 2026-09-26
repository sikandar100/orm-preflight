import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserNick1727500000503 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "nick" text`)
  }
}
