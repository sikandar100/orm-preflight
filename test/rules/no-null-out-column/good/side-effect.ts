import { MigrationInterface, QueryRunner } from 'typeorm'

// The UPDATE moves employees to another department and resets the audit column as a side
// effect. rewrites-existing-rows lists it, and names the cleared column.
export class MergeDepartments1727600000813 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "employees" SET "department_id" = 2, "updated_by" = NULL WHERE "department_id" = 7`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
