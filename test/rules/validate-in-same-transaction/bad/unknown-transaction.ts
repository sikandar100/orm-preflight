// fixture: {"typeorm":{"transactionMode":"each"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

declare const useTransaction: boolean

// orm-preflight cannot tell whether this migration runs in a transaction.
export class ValidateMaybe1727500000604 implements MigrationInterface {
  transaction = useTransaction

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_age" CHECK ("age" >= 0) NOT VALID`,
    )
    await queryRunner.query(`ALTER TABLE "users" VALIDATE CONSTRAINT "CHK_age"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
