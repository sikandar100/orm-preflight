import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm'

export class AddIndexBuilder1727500000102 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex('users', new TableIndex({ name: 'IDX_email', columnNames: ['email'], isUnique: true }))
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
