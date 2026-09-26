import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddEnumValue1727500000513 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."users_status_enum" ADD VALUE 'banned'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
