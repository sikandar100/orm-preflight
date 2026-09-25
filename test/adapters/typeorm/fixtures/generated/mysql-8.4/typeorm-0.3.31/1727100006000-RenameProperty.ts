import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameProperty1727100006000 implements MigrationInterface {
    name = 'RenameProperty1727100006000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`age\` \`years\` int NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`years\` \`age\` int NOT NULL`);
    }

}
