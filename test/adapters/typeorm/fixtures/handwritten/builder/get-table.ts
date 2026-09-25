import { MigrationInterface, QueryRunner } from 'typeorm'

export class GetTable1727200000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users')
    const archived = await queryRunner.getTable('archive.users')
    const column = table!.findColumnByName('legacy')!
    if (await queryRunner.hasColumn('users', 'legacy')) {
      await queryRunner.dropColumn(table!, 'legacy')
    }
    await queryRunner.dropColumn(archived!, column)
    await queryRunner.hasTable('users')
    const tables = await queryRunner.getTables(['users'])
    await queryRunner.dropTable(tables[0]!)
  }

  public async down(): Promise<void> {}
}
