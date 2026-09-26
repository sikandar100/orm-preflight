import { MigrationInterface, QueryRunner, TableCheck, TableIndex, TableUnique } from 'typeorm'

export class DropEmailIndexBuilder1727500000422 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('users', 'IDX_users_email')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
