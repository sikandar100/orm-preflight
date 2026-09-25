import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm'

// The builder example from the TypeORM migrations documentation.
export class QuestionRefactoringTIMESTAMP implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'question',
        columns: [
          { name: 'id', type: 'int', isPrimary: true },
          { name: 'name', type: 'varchar' },
        ],
      }),
      true,
    )

    await queryRunner.createIndex(
      'question',
      new TableIndex({ name: 'IDX_QUESTION_NAME', columnNames: ['name'] }),
    )

    await queryRunner.createTable(
      new Table({
        name: 'answer',
        columns: [
          { name: 'id', type: 'int', isPrimary: true },
          { name: 'name', type: 'varchar' },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    )

    await queryRunner.addColumn(
      'answer',
      new TableColumn({ name: 'questionId', type: 'int' }),
    )

    await queryRunner.createForeignKey(
      'answer',
      new TableForeignKey({
        columnNames: ['questionId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'question',
        onDelete: 'CASCADE',
      }),
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('answer')
    const foreignKey = table.foreignKeys.find((fk) => fk.columnNames.indexOf('questionId') !== -1)
    await queryRunner.dropForeignKey('answer', foreignKey)
    await queryRunner.dropColumn('answer', 'questionId')
    await queryRunner.dropTable('answer')
    await queryRunner.dropIndex('question', 'IDX_QUESTION_NAME')
    await queryRunner.dropTable('question')
  }
}

export class FindColumn1727200000019 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('answer')
    const foreignKey = table!.foreignKeys.find((fk) => fk.columnNames.indexOf('questionId') !== -1)
    await queryRunner.dropForeignKey(table!, foreignKey!)
    await queryRunner.dropColumn(table!, table!.findColumnByName('questionId')!)
    await queryRunner.changeColumn(
      table!,
      table!.findColumnByName('name')!,
      new TableColumn({ name: 'name', type: 'text' }),
    )
  }

  async down(): Promise<void> {}
}
