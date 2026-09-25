import { MigrationInterface, QueryRunner } from 'typeorm'

export class Nullable1727500000124 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "nickname" character varying`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
