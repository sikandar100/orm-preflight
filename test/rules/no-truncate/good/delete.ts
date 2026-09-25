import { MigrationInterface, QueryRunner } from 'typeorm'

export class DeleteRows1727500000043 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "sessions" WHERE "expires_at" < now()`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
