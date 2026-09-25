import { MigrationInterface, QueryRunner } from 'typeorm'
import { seedUsers } from './seed'

export class ImportedHelper1727500000073 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (process.env.SEED) await seedUsers(queryRunner)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
