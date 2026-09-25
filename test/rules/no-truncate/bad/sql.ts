import { MigrationInterface, QueryRunner } from 'typeorm'

export class TruncateSql1727500000041 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`TRUNCATE "sessions", "tokens"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
