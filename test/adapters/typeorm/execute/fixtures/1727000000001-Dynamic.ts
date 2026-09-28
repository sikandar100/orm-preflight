import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'
import { indexSql, TENANT_TABLES } from './tables'

export class Dynamic1727000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('noise that must not reach the output')
    for (const table of TENANT_TABLES) {
      await queryRunner.query(indexSql(table))
    }
    await queryRunner.addColumn('users', new TableColumn({ name: 'nickname', type: 'varchar' }))
  }

  public async down(): Promise<void> {
    throw new Error('irreversible')
  }
}
