import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropTableBuilder1727500000032 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('old_audit')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
