import { MigrationInterface, QueryRunner } from 'typeorm'

export class RenameTableBuilder1727500000062 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameTable('users', 'accounts')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
