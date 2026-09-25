import { MigrationInterface, QueryRunner, TableForeignKey, TableIndex, TableUnique } from 'typeorm'
import { Names } from './constants'

export class OptionalNames1727200000027 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createUniqueConstraint(
      'organizations',
      new TableUnique({ name: Names.WORKSPACE_SLUG_UNIQUE, columnNames: ['slug'] }),
    )
    await queryRunner.createIndex('organizations', new TableIndex({ name: Names.SLUG_INDEX, columnNames: ['slug'] }))
    await queryRunner.createForeignKey(
      'orders',
      new TableForeignKey({ name: Names.FK, columnNames: ['org_id'], referencedTableName: Names.ORGS, referencedColumnNames: ['id'] }),
    )
    const table = await queryRunner.getTable('workflow_bundles')
    if (!table) return
    const redundantIndex = table.indices.find((idx) => idx.name === 'idx_bundle_app_version_id')
    if (redundantIndex) {
      await queryRunner.dropIndex('workflow_bundles', redundantIndex)
    }
    // A value that changes behavior stays strict.
    await queryRunner.dropIndex('workflow_bundles', new TableIndex({ name: 'x', columnNames: [], isConcurrent: Names.CONCURRENT }))
    await queryRunner.createIndex('workflow_bundles', new TableIndex({ columnNames: ['y'], isUnique: Names.UNIQUE }))
  }

  public async down(): Promise<void> {}
}
