import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm'

export class AddNotNullBuilder1727500000122 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('users', new TableColumn({ name: 'nickname', type: 'varchar' }))
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
