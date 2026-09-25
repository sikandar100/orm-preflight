import { MigrationInterface, QueryRunner } from 'typeorm'

export class RenameAsDropAdd1727500000021 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "age"`)
    await queryRunner.query(`ALTER TABLE "users" ADD "years" integer`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
