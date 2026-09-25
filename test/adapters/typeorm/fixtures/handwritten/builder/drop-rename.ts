import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm'

export class DropRename1727200000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({ name: 'audit', columns: [{ name: 'id', type: 'int', isPrimary: true }] }),
      true,
    )
    await queryRunner.createTable(new Table({ name: 'archive.events', columns: [] }))
    await queryRunner.createTable(new Table({ name: 'logs', schema: 'ops', columns: [] }))
    await queryRunner.dropTable('old_audit')
    await queryRunner.dropTable(new Table({ name: 'older_audit' }), true)
    await queryRunner.renameTable('users', 'accounts')
    await queryRunner.dropColumn('users', 'legacy_email')
    await queryRunner.dropColumn('users', new TableColumn({ name: 'legacy_phone', type: 'text' }))
    await queryRunner.dropColumns('users', ['a', new TableColumn({ name: 'b', type: 'int' })])
    await queryRunner.renameColumn('users', 'name', 'full_name')
    await queryRunner.renameColumn('users', new TableColumn({ name: 'x', type: 'int' }), 'y')
    await queryRunner.clearTable('sessions')
  }

  public async down(): Promise<void> {}
}
