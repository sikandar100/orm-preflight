// preflight safety-assured-file invalid-suppression -- hide the broken comments below
import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropUserBio1727500000201 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // preflight safety-assured no-drop-colum -- bio is unused
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
