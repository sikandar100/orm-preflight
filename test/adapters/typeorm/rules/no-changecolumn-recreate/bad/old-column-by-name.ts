import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm'

export class ChangeByName1727500000172 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn('users', 'name', new TableColumn({ name: 'name', type: 'varchar', length: '255' }))
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
