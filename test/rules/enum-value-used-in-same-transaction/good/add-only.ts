import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddArchived1727500000446 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "order_status_enum" ADD VALUE 'archived'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
