import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm'

export class AddRelationBuilder1727500000152 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createForeignKey('posts', new TableForeignKey({ columnNames: ['authorId'], referencedTableName: 'users', referencedColumnNames: ['id'] }))
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
