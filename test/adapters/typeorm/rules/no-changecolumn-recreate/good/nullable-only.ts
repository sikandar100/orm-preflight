import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm'

export class ChangeNullable1727500000174 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn('users', new TableColumn({ name: 'bio', type: 'text' }), new TableColumn({ name: 'bio', type: 'text', isNullable: true }))
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
