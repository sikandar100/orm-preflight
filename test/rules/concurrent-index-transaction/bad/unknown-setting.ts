// fixture: {"typeorm":{"transactionMode":"each"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class ConcurrentUnknown1727500000114 implements MigrationInterface {
  transaction = process.env.NO_TX !== undefined

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_a" ON "users" ("a")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
