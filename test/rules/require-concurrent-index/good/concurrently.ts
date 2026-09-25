// fixture: {"typeorm":{"transactionMode":"each"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddIndexConcurrently1727500000103 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_users_email" ON "users" ("email")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
