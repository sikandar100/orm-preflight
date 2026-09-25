// fixture: {"postgresVersion":18}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class SetNotNull181727500000163 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
