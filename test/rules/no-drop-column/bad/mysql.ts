// fixture: {"dialect":"mysql"}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropColumnMysql1727500000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`legacy\``)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
