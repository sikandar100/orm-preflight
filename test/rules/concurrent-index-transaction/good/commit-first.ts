// fixture: {"typeorm":{"transactionMode":"each"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class ConcurrentAfterCommit1727500000116 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.commitTransaction()
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_users_email" ON "users" ("email")`)
    await queryRunner.startTransaction()
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
