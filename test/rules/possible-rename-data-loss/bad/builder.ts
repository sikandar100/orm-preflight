import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm'

export class RenameAsDropAddBuilder1727500000022 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('users', new TableColumn({ name: 'full_name', type: 'text', isNullable: true }))
    await queryRunner.dropColumn('users', 'name')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
