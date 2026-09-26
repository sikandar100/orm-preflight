import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAgeCheckNotValid1727500000403 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "CHK_users_age" CHECK ("age" >= 0) NOT VALID`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
