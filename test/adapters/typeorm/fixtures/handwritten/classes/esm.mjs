export class EsmMigration1727200000040 {
  name = 'EsmMigration1727200000040'

  async up(queryRunner) {
    await queryRunner.query('ALTER TABLE "users" ADD "esm" integer')
  }

  async down(queryRunner) {
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "esm"')
  }
}
