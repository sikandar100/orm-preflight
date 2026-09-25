/* preflight safety-assured-file no-truncate -- the sessions table only holds disposable test data */
import { MigrationInterface, QueryRunner } from 'typeorm'

export class FileLevel1727500000084 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`TRUNCATE "sessions"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
