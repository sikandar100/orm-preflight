import { MigrationInterface, QueryRunner } from 'typeorm'

export class TruncateBuilder1727500000042 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.clearTable('sessions')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
