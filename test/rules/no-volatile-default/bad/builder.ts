import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm'

export class VolatileBuilder1727500000133 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('users', new TableColumn({ name: 'token', type: 'uuid', isGenerated: true, generationStrategy: 'uuid' }))
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
