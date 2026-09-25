// fixture: {"dialect":"mysql"}
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class ChangeColumnMysql1727200000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'users',
      new TableColumn({ name: 'id', type: 'varchar', length: '36' }),
      new TableColumn({ name: 'id', type: 'varchar', length: '36', isGenerated: true, generationStrategy: 'uuid' }),
    )
    await queryRunner.changeColumn(
      'users',
      new TableColumn({ name: 'n', type: 'int' }),
      new TableColumn({ name: 'n', type: 'int', isGenerated: true, generationStrategy: 'increment' }),
    )
    await queryRunner.changeColumn(
      'users',
      new TableColumn({ name: 'v', type: 'int' }),
      new TableColumn({ name: 'v', type: 'int', generatedType: 'VIRTUAL', asExpression: 'a + b' }),
    )
    await queryRunner.changeColumn(
      'users',
      new TableColumn({ name: 'w', type: 'int', generatedType: 'VIRTUAL', asExpression: 'a + b' }),
      new TableColumn({ name: 'w', type: 'int', generatedType: 'STORED', asExpression: 'a + b' }),
    )
    // Stored generated column added in place: MySQL does not recreate here.
    await queryRunner.changeColumn(
      'users',
      new TableColumn({ name: 's', type: 'int' }),
      new TableColumn({ name: 's', type: 'int', generatedType: 'STORED', asExpression: 'a + b' }),
    )
  }

  public async down(): Promise<void> {}
}
