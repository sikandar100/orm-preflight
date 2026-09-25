import { MigrationInterface, QueryRunner } from 'typeorm'

export class WidenVarchar1727500000144 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "name" TYPE character varying(255)`)
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "bio" TYPE text`)
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "note" TYPE varchar`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
