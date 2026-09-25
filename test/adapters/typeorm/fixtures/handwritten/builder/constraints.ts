import { MigrationInterface, QueryRunner, TableCheck, TableForeignKey, TableUnique } from 'typeorm'

export class Constraints1727200000015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createForeignKey(
      'posts',
      new TableForeignKey({ columnNames: ['author_id'], referencedTableName: 'users', referencedColumnNames: ['id'] }),
    )
    await queryRunner.createForeignKeys('comments', [
      new TableForeignKey({
        name: 'FK_comments_post',
        columnNames: ['post_id'],
        referencedSchema: 'content',
        referencedTableName: 'posts',
        referencedColumnNames: ['id'],
      }),
    ])
    await queryRunner.dropForeignKey('posts', 'FK_old')
    await queryRunner.dropForeignKeys('posts', [new TableForeignKey({ name: 'FK_older', columnNames: [], referencedTableName: 'x', referencedColumnNames: [] })])
    await queryRunner.createPrimaryKey('tags', ['id'])
    await queryRunner.createPrimaryKey('tags', ['id', 'kind'], 'PK_tags')
    await queryRunner.dropPrimaryKey('tags')
    await queryRunner.createUniqueConstraint('users', new TableUnique({ name: 'UQ_users_email', columnNames: ['email'] }))
    await queryRunner.createUniqueConstraints('users', [new TableUnique({ columnNames: ['phone'] })])
    await queryRunner.dropUniqueConstraint('users', 'UQ_old')
    await queryRunner.dropUniqueConstraints('users', [new TableUnique({ name: 'UQ_older', columnNames: ['x'] })])
    await queryRunner.createCheckConstraint('users', new TableCheck({ name: 'CHK_age', expression: '"age" > 0' }))
    await queryRunner.createCheckConstraints('users', [new TableCheck({ expression: '"score" >= 0' })])
    await queryRunner.dropCheckConstraint('users', 'CHK_old')
    await queryRunner.dropCheckConstraints('users', [new TableCheck({ name: 'CHK_older', expression: 'true' })])
  }

  public async down(): Promise<void> {}
}
