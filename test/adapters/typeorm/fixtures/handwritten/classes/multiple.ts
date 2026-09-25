import { MigrationInterface, QueryRunner } from 'typeorm'

export class First1727200000030 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 1 AS first')
  }

  public async down(): Promise<void> {}
}

class NotExported1727200000031 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 2 AS not_exported')
  }

  public async down(): Promise<void> {}
}

export class NoUpMethod {
  public async down(): Promise<void> {}
}

export const notAClass = { up: () => undefined }

export class Second1727200000032 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 3 AS second')
  }

  public async down(): Promise<void> {}
}
