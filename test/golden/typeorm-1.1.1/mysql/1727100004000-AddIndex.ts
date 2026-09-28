import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndex1727100004000 implements MigrationInterface {
    name = 'AddIndex1727100004000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX \`IDX_users_email\` ON \`users\` (\`email\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_users_email\` ON \`users\``);
    }

}
