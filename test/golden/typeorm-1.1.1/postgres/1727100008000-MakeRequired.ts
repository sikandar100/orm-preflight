import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeRequired1727100008000 implements MigrationInterface {
    name = 'MakeRequired1727100008000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "bio" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "bio" DROP NOT NULL`);
    }

}
