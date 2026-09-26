// fixture: {"typeorm":{"transactionMode":"each"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropEmailIndexConcurrently1727500000423 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX CONCURRENTLY "IDX_users_email"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
