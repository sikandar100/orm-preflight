import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPrimaryKey1727500000412 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "PK_events" PRIMARY KEY ("id")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
