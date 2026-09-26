import { MigrationInterface, QueryRunner, TableCheck, TableIndex, TableUnique } from 'typeorm'

export class AddUniqueBuilder1727500000413 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createUniqueConstraint('users', new TableUnique({ name: 'UQ_users_email', columnNames: ['email'] }))
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
