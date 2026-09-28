import { MigrationInterface, QueryRunner } from 'typeorm'

export class LeavesTransaction1727000000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const index = ['IDX', 'users', 'email'].join('_')
    await queryRunner.commitTransaction()
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "${index}" ON "users" ("email")`)
    await queryRunner.startTransaction()
  }

  public async down(): Promise<void> {
    throw new Error('irreversible')
  }
}
