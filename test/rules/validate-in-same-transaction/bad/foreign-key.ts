import { MigrationInterface, QueryRunner } from 'typeorm'

export class ValidateAuthor1727500000602 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "posts" ADD CONSTRAINT "FK_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") NOT VALID`,
    )
    await queryRunner.query(`ALTER TABLE "posts" VALIDATE CONSTRAINT "FK_author"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
