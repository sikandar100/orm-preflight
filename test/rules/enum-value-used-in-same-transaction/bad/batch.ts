// fixture: {"typeorm":{"transactionMode":"each"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAndUseInBatch1727500000443 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "mood" ADD VALUE 'happy'; UPDATE "people" SET "mood" = 'happy'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
