import { MigrationInterface, QueryRunner } from "typeorm";

export class IntToBigint1727100002000 implements MigrationInterface {
    name = 'IntToBigint1727100002000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`age\``);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`age\` bigint NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`age\``);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`age\` int NOT NULL`);
    }

}
