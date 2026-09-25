import { MigrationInterface, QueryRunner } from 'typeorm'

export class RecreateGenerated1727500000015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exif" DROP COLUMN "searchable"`)
    await queryRunner.query(`ALTER TABLE "exif" ADD "searchable" tsvector GENERATED ALWAYS AS (to_tsvector('simple', "city")) STORED`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
