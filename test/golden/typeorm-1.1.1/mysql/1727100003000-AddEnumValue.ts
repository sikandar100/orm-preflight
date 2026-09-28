import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEnumValue1727100003000 implements MigrationInterface {
    name = 'AddEnumValue1727100003000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`status\` \`status\` enum ('active', 'inactive', 'banned') NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`status\` \`status\` enum ('active', 'inactive') NOT NULL`);
    }

}
