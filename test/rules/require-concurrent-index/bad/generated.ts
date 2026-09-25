import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddIndex1727500000101 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email") `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
