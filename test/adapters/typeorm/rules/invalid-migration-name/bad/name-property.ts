import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUsersEmail1727500000191 implements MigrationInterface {
  name = 'AddUsersEmail'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SELECT 1`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
