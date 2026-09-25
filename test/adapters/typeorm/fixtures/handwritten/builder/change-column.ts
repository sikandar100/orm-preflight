import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

declare const computedLength: string

export class ChangeColumn1727200000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Old column passed by name: TypeORM reads it from the database, so it cannot be compared.
    await queryRunner.changeColumn('users', 'name', new TableColumn({ name: 'name', type: 'varchar', length: '255' }))
    // Length change: TypeORM drops and re-adds the column.
    await queryRunner.changeColumn(
      'users',
      new TableColumn({ name: 'name', type: 'varchar', length: '100' }),
      new TableColumn({ name: 'name', type: 'varchar', length: '255' }),
    )
    // Rename only: altered in place, reported as a rename.
    await queryRunner.changeColumn(
      'users',
      new TableColumn({ name: 'email', type: 'varchar' }),
      new TableColumn({ name: 'email_address', type: 'varchar' }),
    )
    // Becomes NOT NULL and unique in place.
    await queryRunner.changeColumn(
      'users',
      new TableColumn({ name: 'phone', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'phone', type: 'varchar', isUnique: true }),
    )
    // Plain object vs TableColumn: the missing length compares as undefined, not "".
    await queryRunner.changeColumn(
      'users',
      new TableColumn({ name: 'code', type: 'varchar' }),
      { name: 'code', type: 'varchar' } as TableColumn,
    )
    // Becomes a stored generated column.
    await queryRunner.changeColumn(
      'orders',
      new TableColumn({ name: 'total', type: 'numeric' }),
      new TableColumn({ name: 'total', type: 'numeric', generatedType: 'STORED', asExpression: 'price * qty' }),
    )
    // Array flag changes.
    await queryRunner.changeColumn(
      'users',
      new TableColumn({ name: 'tags', type: 'text' }),
      new TableColumn({ name: 'tags', type: 'text', isArray: true }),
    )
    // A compared option that cannot be resolved.
    await queryRunner.changeColumn(
      'users',
      new TableColumn({ name: 'title', type: 'varchar', length: computedLength }),
      new TableColumn({ name: 'title', type: 'varchar', length: '10' }),
    )
    await queryRunner.changeColumns('users', [
      {
        oldColumn: new TableColumn({ name: 'a', type: 'int' }),
        newColumn: new TableColumn({ name: 'a', type: 'bigint' }),
      },
    ])
  }

  public async down(): Promise<void> {}
}
