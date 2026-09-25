import { describe, expect, it } from 'vitest'
import { extractTypeorm } from '../../src/adapters/typeorm/index.js'
import { parseMigrations } from '../../src/sql/index.js'

function migration(body: string) {
  const text = `export class M1727400000000 {\n  async up(queryRunner) {\n${body}\n  }\n}\n`
  return extractTypeorm({ path: 'm.ts', text }, { dialect: 'postgres', options: {} })
}

describe('parseMigrations', () => {
  it('reports invalid SQL as unanalyzable, located at the error', async () => {
    const [m] = await parseMigrations(
      migration(`    await queryRunner.query('ALTER TABLE "t" ADD COLUMN')`),
      { dialect: 'postgres' },
    )
    expect(m?.up).toEqual([
      {
        kind: 'unanalyzable',
        reason: 'Could not parse the SQL: syntax error at end of input',
        loc: { file: 'm.ts', line: 3, column: 56 },
        origin: 'sql',
        sql: 'ALTER TABLE "t" ADD COLUMN',
      },
    ])
  })

  it('keeps builder operations, their flags, and applies the configured default schema', async () => {
    const [m] = await parseMigrations(
      migration(`    if (flag) await queryRunner.dropTable('users')`),
      { dialect: 'postgres', defaultSchema: 'app' },
    )
    expect(m?.up).toEqual([
      {
        kind: 'drop_table',
        table: { schema: 'app', name: 'users' },
        loc: { file: 'm.ts', line: 3, column: 21 },
        origin: 'builder',
        conditional: true,
      },
    ])
  })

  it('marks conditional SQL and each statement of a batch', async () => {
    const [m] = await parseMigrations(
      migration(`    if (flag) await queryRunner.query('SELECT 1; DROP TABLE a; DROP TABLE b')`),
      { dialect: 'postgres' },
    )
    expect(m?.up.map((op) => [op.kind, op.conditional, op.batch, op.sql])).toEqual([
      ['drop_table', true, { index: 1, size: 3 }, 'DROP TABLE a'],
      ['drop_table', true, { index: 2, size: 3 }, 'DROP TABLE b'],
    ])
  })

  it('does not add a default schema for MySQL', async () => {
    const extracted = extractTypeorm(
      {
        path: 'm.ts',
        text: "export class M1727400000000 { async up(qr) { await qr.query('DROP TABLE `a`') } }",
      },
      { dialect: 'mysql', options: {} },
    )
    const [m] = await parseMigrations(extracted, { dialect: 'mysql' })
    expect(m?.up[0]).toMatchObject({ kind: 'drop_table', table: { name: 'a' } })
  })
})
