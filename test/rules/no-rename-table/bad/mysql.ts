// fixture: {"dialect":"mysql"}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class RenameTableMysql1727500000063 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`RENAME TABLE \`users\` TO \`accounts\``)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
