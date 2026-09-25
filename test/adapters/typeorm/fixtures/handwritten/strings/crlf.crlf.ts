import { MigrationInterface, QueryRunner } from 'typeorm'

export class Crlf1727200000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD "a" integer;
      ALTER TABLE "users" ADD "b" integer;
    `)
    await queryRunner.query('ALTER TABLE "users" ADD "c" integer')
  }

  public async down(): Promise<void> {}
}
