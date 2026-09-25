import { MigrationInterface, QueryRunner, TableColumn, View } from 'typeorm'

declare function makeColumn(): TableColumn
declare const options: { isNullable: boolean }
declare const tableName: string

export class Unresolved1727200000017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createView(new View({ name: 'v', expression: 'SELECT 1' }))
    await queryRunner.addColumn('users', makeColumn())
    await queryRunner.addColumn('users', new TableColumn({ name: 'a', type: 'int', ...options }))
    await queryRunner.addColumn('users', new TableColumn({ name: 'b', type: 'int', isNullable: options.isNullable }))
    await queryRunner.addColumn('users', new TableColumn({ name: 'c', type: 'int', default: Date.now() }))
    await queryRunner.dropColumn(tableName, 'd')
    await queryRunner.dropColumns('users', [...['e']])
    await queryRunner.addColumns('users', makeColumns())
    await queryRunner.dropIndex('users', new TableIndex({ columnNames: ['x'] }))
    await queryRunner.addColumn('users', new TableColumn({ type: 'int' }))
    await queryRunner.dropColumn('users', ...['f'])
    await queryRunner.release()
  }

  public async down(): Promise<void> {}
}
