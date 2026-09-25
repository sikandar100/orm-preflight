// fixture: {"dialect":"mysql"}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class RecreateMysql1727500000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`age\``)
    await queryRunner.query(`ALTER TABLE \`users\` ADD \`age\` bigint NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
