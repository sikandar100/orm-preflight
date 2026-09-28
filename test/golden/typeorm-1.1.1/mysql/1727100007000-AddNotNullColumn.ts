import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotNullColumn1727100007000 implements MigrationInterface {
    name = 'AddNotNullColumn1727100007000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`nickname\` varchar(255) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`nickname\``);
    }

}
