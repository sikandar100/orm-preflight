import { MigrationInterface, QueryRunner } from 'typeorm'

export class NewTableRelation1727500000154 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "comments" ("id" int, "postId" int)`)
    await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_post" FOREIGN KEY ("postId") REFERENCES "posts"("id")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
