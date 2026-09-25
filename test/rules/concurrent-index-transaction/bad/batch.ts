// fixture: {"typeorm":{"transactionMode":"each"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class ConcurrentBatch1727500000113 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_a" ON "users" ("a"); CREATE INDEX CONCURRENTLY "IDX_b" ON "users" ("b")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
