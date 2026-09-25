// fixture: {"transactionMode":"each"}
import { MigrationInterface, QueryRunner } from 'typeorm'

declare const dynamicName: string
declare const useTransaction: boolean

export class NameWins1727200000050 implements MigrationInterface {
  name = 'RenamedMigration1727200000099'
  transaction = false as const

  public async up(queryRunner: QueryRunner): Promise<void> {}
  public async down(): Promise<void> {}
}

export class DynamicName1727200000051 implements MigrationInterface {
  name = dynamicName
  transaction = useTransaction

  public async up(queryRunner: QueryRunner): Promise<void> {}
  public async down(): Promise<void> {}
}

export class NoTimestamp implements MigrationInterface {
  transaction = true

  public async up(queryRunner: QueryRunner): Promise<void> {}
  public async down(): Promise<void> {}
}

export const Anonymous = class implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {}
  public async down(): Promise<void> {}
}
