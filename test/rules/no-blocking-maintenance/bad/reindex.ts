import { MigrationInterface, QueryRunner } from 'typeorm'

export class ReindexUsers1727500000433 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REINDEX INDEX "IDX_users_email"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
