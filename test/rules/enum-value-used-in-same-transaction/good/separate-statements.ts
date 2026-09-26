// fixture: {"typeorm":{"transactionMode":"each"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAndUseSeparately1727500000445 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "mood" ADD VALUE 'happy'`)
    await queryRunner.query(`UPDATE "people" SET "mood" = 'happy'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
