// fixture: {"typeorm":{"transactionMode":"each"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

// Without a transaction, each query() call commits on its own.
export class ValidateSeparately1727600000603 implements MigrationInterface {
  transaction = false as const

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_age" CHECK ("age" >= 0) NOT VALID`,
    )
    await queryRunner.query(`ALTER TABLE "users" VALIDATE CONSTRAINT "CHK_age"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
