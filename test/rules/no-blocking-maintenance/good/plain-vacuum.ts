// fixture: {"typeorm":{"transactionMode":"each"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class VacuumAnalyze1727500000435 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`VACUUM ANALYZE "users"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
