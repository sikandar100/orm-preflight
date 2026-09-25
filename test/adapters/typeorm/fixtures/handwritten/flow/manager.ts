import { MigrationInterface, QueryRunner } from 'typeorm'

declare class User {}

export class Manager1727200000022 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.manager.query('UPDATE "users" SET "active" = true')
    await queryRunner.manager.getRepository(User).save({ id: 1 })
    await queryRunner.manager.createQueryBuilder().update(User).set({}).execute()
    await queryRunner.connection.query('SELECT 1')
    await queryRunner.dataSource.query('SELECT 1')
    await queryRunner.dataSource.manager.query('SELECT 1')
    const escaped = queryRunner.dataSource.driver.escape('users')
    const metadata = queryRunner.connection.getMetadata(User)
    const isPostgres = queryRunner.connection.options.type === 'postgres'
    if (isPostgres) await queryRunner.query('SELECT 2 AS postgres_only')
  }

  public async down(): Promise<void> {}
}
