import { MigrationInterface, QueryRunner } from 'typeorm'

export class Unanalyzable1727500000071 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const column = 'bio'
    await queryRunner.query(`ALTER TABLE "users" ADD "${column}" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
