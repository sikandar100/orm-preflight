// fixture: {"transactionMode":"none"}
import { MigrationInterface, QueryRunner } from 'typeorm'

export class DefaultNone1727200000052 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {}
  public async down(): Promise<void> {}
}

export class OptIn1727200000053 implements MigrationInterface {
  transaction = true

  public async up(queryRunner: QueryRunner): Promise<void> {}
  public async down(): Promise<void> {}
}
