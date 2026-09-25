import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm'

export class Indexes1727200000014 implements MigrationInterface {
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex('users', new TableIndex({ name: 'IDX_email', columnNames: ['email'] }))
    await queryRunner.createIndex(
      'users',
      new TableIndex({ name: 'IDX_email_unique', columnNames: ['email'], isUnique: true, isConcurrent: true }),
    )
    await queryRunner.createIndices('orders', [
      new TableIndex({ columnNames: ['user_id'] }),
      { name: 'IDX_orders_created', columnNames: ['created_at'], isConcurrent: true } as TableIndex,
    ])
    await queryRunner.dropIndex('users', 'IDX_old')
    await queryRunner.dropIndex('users', new TableIndex({ name: 'IDX_older', columnNames: ['x'], isConcurrent: true }))
  }

  public async down(): Promise<void> {}
}
