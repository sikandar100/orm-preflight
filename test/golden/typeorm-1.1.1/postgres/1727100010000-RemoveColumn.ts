import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveColumn1727100010000 implements MigrationInterface {
    name = 'RemoveColumn1727100010000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "legacyCode"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "legacyCode" character varying`);
    }

}
