import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

const nicknameColumn = new TableColumn({ name: 'nickname', type: 'varchar', length: '50', isNullable: true })

export class Columns1727200000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('users', new TableColumn({ name: 'age', type: 'int' }))
    await queryRunner.addColumn('users', { name: 'bio', type: 'text', isNullable: true } as TableColumn)
    await queryRunner.addColumn('users', nicknameColumn)
    await queryRunner.addColumn('users', new TableColumn({ name: 'status', type: 'varchar', default: "'active'" }))
    await queryRunner.addColumn('users', new TableColumn({ name: 'score', type: 'int', default: 0 }))
    await queryRunner.addColumn('users', new TableColumn({ name: 'token', type: 'uuid', default: 'gen_random_uuid()' }))
    await queryRunner.addColumn('users', new TableColumn({ name: 'created', type: 'timestamptz', default: 'now()' }))
    await queryRunner.addColumns('orders', [
      new TableColumn({ name: 'seq', type: 'int', isGenerated: true, generationStrategy: 'increment' }),
      new TableColumn({ name: 'ref', type: 'uuid', isGenerated: true, generationStrategy: 'uuid' }),
      new TableColumn({ name: 'num', type: 'int', isGenerated: true, generationStrategy: 'identity' }),
      new TableColumn({ name: 'total', type: 'numeric', generatedType: 'STORED', asExpression: 'price * qty' }),
      new TableColumn({ name: 'tags', type: 'text', isArray: true, isNullable: true }),
      new TableColumn({ name: 'legacy', type: 'int', isGenerated: true }),
    ])
    await queryRunner.addColumn('public.users', new TableColumn({ name: 'flag', type: 'boolean', default: false }))
    await queryRunner.addColumn('users', new TableColumn({ name: 'empty', type: 'int', default: null, isNullable: true }))
  }

  public async down(): Promise<void> {}
}
