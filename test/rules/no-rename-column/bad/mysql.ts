// fixture: {"dialect":"mysql"}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class RenameColumnMysql1727500000053 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` CHANGE \`age\` \`years\` int NOT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
