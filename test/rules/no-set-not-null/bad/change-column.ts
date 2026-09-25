import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm'

export class SetNotNullChangeColumn1727500000162 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn('users', new TableColumn({ name: 'email', type: 'text', isNullable: true }), new TableColumn({ name: 'email', type: 'text' }))
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
