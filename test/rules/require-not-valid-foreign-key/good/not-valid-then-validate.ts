import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddRelationNotValid1727500000153 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "posts" ADD CONSTRAINT "FK_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") NOT VALID`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
