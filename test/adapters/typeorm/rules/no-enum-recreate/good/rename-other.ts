import { MigrationInterface, QueryRunner } from 'typeorm'

export class RenameEnum1727500000515 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."mood" RENAME TO "feeling"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
