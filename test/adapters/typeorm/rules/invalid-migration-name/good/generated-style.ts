import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUsersEmail1727500000192 implements MigrationInterface {
  name = 'AddUsersEmail1727500000192'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SELECT 1`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
