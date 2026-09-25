// fixture: {"typeorm":{"transactionMode":"each"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class ConcurrentOptedOut1727500000115 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_users_email" ON "users" ("email")`)
    await queryRunner.query(`REINDEX INDEX CONCURRENTLY "IDX_old"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
