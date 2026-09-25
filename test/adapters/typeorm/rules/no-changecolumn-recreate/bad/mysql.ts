// fixture: {"dialect":"mysql"}
import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm'

export class ChangeColumnMysql1727500000173 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn('users', new TableColumn({ name: 'age', type: 'int' }), new TableColumn({ name: 'age', type: 'bigint' }))
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
