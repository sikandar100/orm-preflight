import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropBio1727300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // preflight safety-assured no-drop-column -- bio removed from the entity in 2.3, deployed everywhere
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`)
    await queryRunner.query(`ALTER TABLE "users" ADD "nickname" character varying`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
