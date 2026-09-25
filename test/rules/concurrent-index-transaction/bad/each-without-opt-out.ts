// fixture: {"typeorm":{"transactionMode":"each"}}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class ConcurrentInEach1727500000112 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_users_email" ON "users" ("email")`)
    await queryRunner.query(`DROP INDEX CONCURRENTLY "IDX_old"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
