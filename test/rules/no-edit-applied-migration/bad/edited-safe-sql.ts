// fixture: {"$change":"modified"}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAuditTable1727000000302 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "audit" ("id" int)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
