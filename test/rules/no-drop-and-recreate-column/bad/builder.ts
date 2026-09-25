import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm'

export class RecreateBuilder1727500000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'age')
    await queryRunner.addColumn('users', new TableColumn({ name: 'age', type: 'bigint', isNullable: true }))
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
