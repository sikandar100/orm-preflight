// fixture: {"dialect":"mysql"}
import { MigrationInterface, QueryRunner } from 'typeorm'

// MySQL keeps only whether there is a WHERE.
export class DeleteMysql1727500000803 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM `sessions` WHERE `expired` = 1')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
