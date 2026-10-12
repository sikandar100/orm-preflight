import { MigrationInterface, QueryRunner } from 'typeorm'

// The new column has a default, so every row holds a value that the foreign key must check.
// Still an error.
export class AddOwner1727500000513 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" ADD "owner_id" integer DEFAULT 1`)
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
