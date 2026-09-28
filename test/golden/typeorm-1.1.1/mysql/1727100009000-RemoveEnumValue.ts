import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveEnumValue1727100009000 implements MigrationInterface {
    name = 'RemoveEnumValue1727100009000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`status\` \`status\` enum ('active') NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`status\` \`status\` enum ('active', 'inactive') NOT NULL`);
    }

}
