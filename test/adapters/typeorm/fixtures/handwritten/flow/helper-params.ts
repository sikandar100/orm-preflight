// fixture: {"dialect":"mysql"}
import { MigrationInterface, QueryRunner } from 'typeorm'

// Ever Gauzy passes the database type into same-file helpers. The helper's parameter must
// resolve to the caller's argument, so branches for other databases are skipped.
export class HelperParams1727000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ever Gauzy reads the type through a helper that validates it and returns it.
    const type = this.databaseType(queryRunner)
    await this.createIndex(queryRunner, type)
    await this.addColumn(queryRunner, 'users')
    await this.reassigned(queryRunner, type)
    if (this.notTheType(queryRunner) === 'postgres') {
      await queryRunner.query('DROP TABLE `maybe`')
    }
  }

  // "type" is the caller's constant: the postgres-only statements are skipped on MySQL.
  private async createIndex(queryRunner: QueryRunner, type: string): Promise<void> {
    const savepoint = type === 'postgres' && queryRunner.isTransactionActive
    if (savepoint) {
      await queryRunner.query(`SAVEPOINT "idx"`)
    }
    await queryRunner.query('CREATE UNIQUE INDEX `IDX_a` ON `role_permission` (`tenantId`)')
    if (type === 'postgres') {
      await queryRunner.query(`RELEASE SAVEPOINT "idx"`)
    }
  }

  // A string argument resolves too, so the table name is known.
  private async addColumn(queryRunner: QueryRunner, table: string): Promise<void> {
    await queryRunner.query('ALTER TABLE `' + table + '` ADD `bio` text')
  }

  private databaseType(queryRunner: QueryRunner): string {
    const type = queryRunner.connection.options.type
    if (!['postgres', 'mysql'].includes(type)) {
      throw new Error(`Unsupported database: ${type}`)
    }
    return type
  }

  // A helper that returns something else is not treated as the database type.
  private notTheType(queryRunner: QueryRunner): string {
    if (queryRunner.isTransactionActive) return 'postgres'
    return queryRunner.connection.options.type
  }

  // A parameter the helper reassigns cannot be trusted: the branch stays conditional.
  private async reassigned(queryRunner: QueryRunner, type: string): Promise<void> {
    if (process.env.FORCE_PG) type = 'postgres'
    if (type === 'postgres') {
      await queryRunner.query('DROP TABLE `legacy`')
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
