import { MigrationInterface, QueryRunner } from 'typeorm'

// At startAfter, so it is part of the adopted history and not checked.
export class History1727000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "legacy"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
