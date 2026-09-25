import { DatabaseTypeEnum } from '@gauzy/config'
import { MigrationInterface, QueryRunner } from 'typeorm'

declare const somethingElse: string

export class DialectBranches1727200000029 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
      case DatabaseTypeEnum.sqlite:
      case DatabaseTypeEnum.betterSqlite3:
        await this.sqliteUp(queryRunner)
        break
      case DatabaseTypeEnum.postgres:
        await this.postgresUp(queryRunner)
        break
      case DatabaseTypeEnum.mysql:
        await this.mysqlUp(queryRunner)
        break
      default:
        throw Error(`Unsupported database: ${queryRunner.connection.options.type}`)
    }

    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query('SELECT 1 AS if_postgres')
    } else {
      await queryRunner.query('SELECT 1 AS else_not_postgres')
    }
    if (['mysql', 'mariadb'].includes(queryRunner.connection.options.type)) {
      await queryRunner.query('SELECT 2 AS includes_mysql')
    }
    const dbType = queryRunner.connection.options.type
    if (dbType !== 'sqlite' && !(dbType === 'mssql')) {
      await queryRunner.query('SELECT 3 AS not_sqlite_and_not_mssql')
    }
    queryRunner.connection.driver.options.type === 'mysql'
      ? await queryRunner.query('SELECT 4 AS ternary_mysql')
      : await queryRunner.query('SELECT 4 AS ternary_other')
    if (queryRunner.connection.options.type === somethingElse) {
      await queryRunner.query('SELECT 5 AS unknown_comparison')
    }
    switch (queryRunner.connection.options.type) {
      case 'postgres':
      case 'mysql':
        await queryRunner.query('SELECT 6 AS shared_case')
      case 'sqlite':
        await queryRunner.query('SELECT 6 AS fall_through')
        break
      case 'mssql':
        await queryRunner.query('SELECT 6 AS mssql_only')
    }
    switch (queryRunner.connection.options.type) {
      case 'sqlite':
        await queryRunner.query('SELECT 7 AS sqlite_only')
        break
      default:
        await queryRunner.query('SELECT 7 AS default_branch')
    }
    if (queryRunner.dataSource.options.type === 'postgres') {
      await queryRunner.query('SELECT 9 AS data_source_postgres')
    }
    switch (queryRunner.dataSource.driver.options.type) {
      case 'mysql':
        await queryRunner.query('SELECT 10 AS data_source_driver_mysql')
    }
    switch (queryRunner.connection.options.type) {
      case somethingElse:
        await queryRunner.query('SELECT 8 AS unresolvable_case')
    }
  }

  private async sqliteUp(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE "t" ("id" integer PRIMARY KEY AUTOINCREMENT)')
  }

  private async postgresUp(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE "t" ("id" SERIAL PRIMARY KEY)')
  }

  private async mysqlUp(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE `t` (`id` int AUTO_INCREMENT PRIMARY KEY)')
  }

  public async down(): Promise<void> {}
}
