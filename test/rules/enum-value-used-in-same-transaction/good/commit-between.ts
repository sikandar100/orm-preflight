// fixture: {"typeorm":{"transactionMode":"each"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class CommitBetween1727500000447 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "mood" ADD VALUE 'happy'`)
    await queryRunner.commitTransaction()
    await queryRunner.startTransaction()
    await queryRunner.query(`UPDATE "people" SET "mood" = 'happy'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
