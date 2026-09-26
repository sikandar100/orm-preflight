import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAgeCheck1727500000401 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "CHK_users_age" CHECK ("age" >= 0)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
