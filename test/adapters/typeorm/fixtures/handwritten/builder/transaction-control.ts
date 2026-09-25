// fixture: {"transactionMode":"each"}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class TransactionControl1727200000018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.commitTransaction()
    await queryRunner.query('CREATE INDEX CONCURRENTLY "IDX_users_email" ON "users" ("email")')
    await queryRunner.startTransaction()
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.rollbackTransaction()
  }
}
