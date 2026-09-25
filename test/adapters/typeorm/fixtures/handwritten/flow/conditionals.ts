import { MigrationInterface, QueryRunner } from 'typeorm'

declare const flag: boolean
declare const items: string[]

export class Conditionals1727200000020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 1 AS always')
    if (flag) {
      await queryRunner.query('SELECT 2 AS in_if')
    } else {
      await queryRunner.query('SELECT 3 AS in_else')
    }
    flag ? await queryRunner.query('SELECT 4 AS ternary') : undefined
    flag && (await queryRunner.query('SELECT 5 AS and_right'))
    ;(await queryRunner.hasTable('users')) || (await queryRunner.query('SELECT 6 AS or_right'))
    switch (items.length) {
      case 0:
        await queryRunner.query('SELECT 7 AS in_switch')
        break
      default:
        break
    }
    for (let i = 0; i < 2; i++) await queryRunner.query('SELECT 8 AS in_for')
    for (const item of items) await queryRunner.query('SELECT 9 AS in_for_of')
    for (const key in items) await queryRunner.query('SELECT 10 AS in_for_in')
    while (flag) await queryRunner.query('SELECT 11 AS in_while')
    do {
      await queryRunner.query('SELECT 12 AS in_do_while')
    } while (flag)
    try {
      await queryRunner.query('SELECT 13 AS in_try')
    } catch (error) {
      await queryRunner.query('SELECT 14 AS in_catch')
    } finally {
      await queryRunner.query('SELECT 15 AS in_finally')
    }
    await Promise.all(items.map((item) => queryRunner.query('SELECT 16 AS in_callback')))
    items.forEach(async function () {
      await queryRunner.query('SELECT 17 AS in_function_callback')
    })
    await queryRunner.query('SELECT 18 AS still_always')
    if (await queryRunner.hasColumn('users', 'done')) return
    await queryRunner.query('SELECT 19 AS after_early_return')
  }

  public async down(): Promise<void> {}
}
