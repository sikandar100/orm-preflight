import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm'

export class RenameColumnBuilder1727500000052 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameColumn('users', 'age', 'years')
    await queryRunner.changeColumn('users', new TableColumn({ name: 'mail', type: 'text' }), new TableColumn({ name: 'email', type: 'text' }))
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
