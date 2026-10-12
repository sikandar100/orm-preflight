import { MigrationInterface, QueryRunner } from 'typeorm'

export class Unanalyzable1727500000071 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // The column name is read from the database, so it is only known at run time.
    const [{ name }] = await queryRunner.query(`SELECT name FROM "settings" LIMIT 1`)
    await queryRunner.query(`ALTER TABLE "users" ADD "${name}" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
