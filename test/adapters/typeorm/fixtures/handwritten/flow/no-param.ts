import { MigrationInterface } from 'typeorm'

export class NoParam1727200000025 implements MigrationInterface {
  public async up(): Promise<void> {
    console.log('nothing to do')
  }

  public async down(): Promise<void> {}
}
