// fixture: {"typeorm":{"transactionMode":"each"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

// No migration transaction, but both statements share one query() call, which PostgreSQL
// runs as one implicit transaction.
export class ValidateInBatch1727500000603 implements MigrationInterface {
  transaction = false as const

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_age" CHECK ("age" >= 0) NOT VALID; ALTER TABLE "users" VALIDATE CONSTRAINT "CHK_age"`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
