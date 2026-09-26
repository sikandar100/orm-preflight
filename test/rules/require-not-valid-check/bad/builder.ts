import { MigrationInterface, QueryRunner, TableCheck, TableIndex, TableUnique } from 'typeorm'

export class AddAgeCheckBuilder1727500000402 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createCheckConstraint('users', new TableCheck({ name: 'CHK_users_age', expression: '"age" >= 0' }))
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
