import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm'

export class WidenWithChangeColumn1727500000171 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn('users', new TableColumn({ name: 'name', type: 'varchar', length: '100' }), new TableColumn({ name: 'name', type: 'varchar', length: '255' }))
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
