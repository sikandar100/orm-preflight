import { MigrationInterface, QueryRunner } from 'typeorm'

export class VarcharUsing1727500000143 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "code" TYPE varchar(10) USING upper("code")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
