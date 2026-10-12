import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm'

// The same with builder calls. Reported as info.
export class AddApproverBuilder1727500000512 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'holidays',
      new TableColumn({ name: 'approver_id', type: 'integer', isNullable: true }),
    )
    await queryRunner.createForeignKey(
      'holidays',
      new TableForeignKey({
        columnNames: ['approver_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
