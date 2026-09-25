import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRelation1727100005000 implements MigrationInterface {
    name = 'AddRelation1727100005000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "posts" ADD CONSTRAINT "FK_c5a322ad12a7bf95460c958e80e" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "posts" DROP CONSTRAINT "FK_c5a322ad12a7bf95460c958e80e"`);
    }

}
