import { describe, expect, it } from 'vitest'
import { extractTypeorm } from '../../../src/adapters/typeorm/index.js'

const options = { dialect: 'postgres' as const, options: {} }

function migration(body: string, before = ''): string {
  return `import { MigrationInterface, QueryRunner } from 'typeorm'
${before}
export class Big1727200000020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
${body}
  }

  public async down(): Promise<void> {}
}
`
}

function steps(text: string) {
  const [m] = extractTypeorm({ path: 'm.ts', text }, options)
  return m?.up ?? []
}

describe('template literals with ${...}', () => {
  it('handles SQL hundreds of thousands of characters long', () => {
    // Real baseline migrations hold a whole schema in one template.
    const columns = Array.from({ length: 20_000 }, (_, i) => `c${String(i)} text`).join(', ')
    const text = migration(
      '    await queryRunner.query(`CREATE TABLE "wide" (${COLUMNS}, "id" int)`)',
      `const COLUMNS = \`${columns}\``,
    )
    const [step] = steps(text)
    expect(step?.kind).toBe('sql')
    expect(step?.kind === 'sql' ? step.sql.length : 0).toBeGreaterThan(200_000)
  })

  it('unrolls at most 100 items and reads a longer loop once, as before', () => {
    const items = Array.from({ length: 101 }, (_, i) => `'t${String(i)}'`).join(', ')
    const text = migration(
      '    for (const t of TABLES) await queryRunner.query(`ALTER TABLE "${t}" ADD "x" int`)',
      `const TABLES = [${items}]`,
    )
    const result = steps(text)
    expect(result).toHaveLength(1)
    expect(result[0]?.kind).toBe('operation')
  })
})
