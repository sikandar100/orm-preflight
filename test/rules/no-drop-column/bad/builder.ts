import { MigrationInterface, QueryRunner } from 'typeorm'

export class DropColumnBuilder1727500000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'legacy_email')
    await queryRunner.dropColumns('users', ['a', 'b'])
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
