import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropEmailIndex1727500000421 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_users_email"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
