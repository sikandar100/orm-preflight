import { MigrationInterface, QueryRunner } from 'typeorm'

export class VacuumUsers1727500000431 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`VACUUM FULL "users"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
