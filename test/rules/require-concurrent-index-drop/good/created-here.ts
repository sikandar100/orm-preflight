// fixture: {"typeorm":{"transactionMode":"each"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class ReplaceIndex1727500000424 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_tmp" ON "users" ("email")`)
    await queryRunner.query(`DROP INDEX "IDX_tmp"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
