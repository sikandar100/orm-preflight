// fixture: {"typeorm":{"transactionMode":"each"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAndUseUnknown1727500000444 implements MigrationInterface {
  transaction = process.env.NO_TX === undefined

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "mood" ADD VALUE 'happy'`)
    await queryRunner.query(`UPDATE "people" SET "mood" = 'happy'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
