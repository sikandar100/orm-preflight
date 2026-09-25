import { MigrationInterface, QueryRunner } from 'typeorm'

export class DownEmpty1727200000060 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {}
  public async down(queryRunner: QueryRunner): Promise<void> {
    // irreversible
  }
}

export class DownMissing1727200000061 {
  public async up(queryRunner: QueryRunner): Promise<void> {}
}

export class DownSemicolons1727200000062 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {}
  public async down(queryRunner: QueryRunner): Promise<void> {
    ;
  }
}

export class DownReal1727200000063 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {}
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 1')
  }
}
