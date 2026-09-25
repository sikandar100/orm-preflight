import { MigrationInterface, QueryRunner } from 'typeorm'
import { importedHelper } from './helpers'

async function moduleHelper(runner: QueryRunner, column: string): Promise<void> {
  await runner.query('ALTER TABLE "users" ADD "from_module_function" integer')
}

const arrowHelper = async (qr: QueryRunner) => {
  await qr.query('ALTER TABLE "users" ADD "from_arrow_const" integer')
}

export class SameFileHelpers1727200000028 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumns(queryRunner)
    await moduleHelper(queryRunner, 'x')
    await arrowHelper(queryRunner)
    if (process.env.SEED) await this.seed('users', queryRunner)
    await this.recursive(queryRunner)
    await importedHelper(queryRunner)
    await this.missingMethod(queryRunner)
    const self = this
    await self.addColumns(queryRunner)
    ;[1].forEach(function (this: unknown) {
      void (this as { addColumns(q: QueryRunner): void }).addColumns(queryRunner)
    })
  }

  private async addColumns(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" ADD "from_class_method" integer')
    await this.nested(queryRunner)
  }

  private nested = async (qr: QueryRunner): Promise<void> => {
    await qr.query('ALTER TABLE "users" ADD "from_nested_arrow_property" integer')
  }

  private async seed(table: string, queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('INSERT INTO "users" DEFAULT VALUES')
  }

  private async recursive(queryRunner: QueryRunner): Promise<void> {
    await this.recursive(queryRunner)
  }

  public async down(): Promise<void> {}
}
