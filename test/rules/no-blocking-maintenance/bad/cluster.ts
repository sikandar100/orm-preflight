import { MigrationInterface, QueryRunner } from 'typeorm'

export class ClusterUsers1727500000432 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CLUSTER "users" USING "PK_users"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
