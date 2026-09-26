// fixture: {"typeorm":{"transactionMode":"each"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class ReindexConcurrently1727500000434 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REINDEX INDEX CONCURRENTLY "IDX_users_email"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
