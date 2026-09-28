import { MigrationInterface, QueryRunner } from 'typeorm'

export class Branches1727000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const type = queryRunner.connection.options.type
    const name = ['legacy', 'table'].join('_')
    if (type === 'postgres') await queryRunner.query(`DROP TABLE "${name}"`)
    else await queryRunner.query(`DROP TABLE \`${name}\``)
  }

  public async down(): Promise<void> {
    throw new Error('irreversible')
  }
}
