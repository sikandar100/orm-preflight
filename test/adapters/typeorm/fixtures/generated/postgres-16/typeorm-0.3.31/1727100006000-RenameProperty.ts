import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameProperty1727100006000 implements MigrationInterface {
    name = 'RenameProperty1727100006000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "age" TO "years"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "years" TO "age"`);
    }

}
