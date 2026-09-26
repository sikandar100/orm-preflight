import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { typeormAdapter } from '../../src/adapters/typeorm/index.js'
import { resolveConfig } from '../../src/config/load.js'
import { parseSuppressionComment } from '../../src/engine/suppression-comments.js'
import { lintSources } from '../../src/lint.js'
import { formatGithub } from '../../src/reporters/github.js'
import type { Finding } from '../../src/rules/types.js'

/**
 * Property-based tests. Migration files are untrusted input: orm-preflight runs on pull
 * requests from forks. Whatever a file contains, linting must finish with findings, never
 * crash, and every finding must point at a real position.
 */

// FC_RUNS raises the number of cases for a deeper local run, such as FC_RUNS=5000.
const RUNS = { numRuns: Number(process.env.FC_RUNS ?? 150) }
const SEVERITIES = new Set(['error', 'warn'])

/** Tokens that reach deep into the SQL parsers and the extractor's string handling. */
const SQL_TOKENS = [
  'ALTER',
  'TABLE',
  'ADD',
  'DROP',
  'COLUMN',
  'CREATE',
  'UNIQUE',
  'INDEX',
  'CONCURRENTLY',
  'ON',
  'TYPE',
  'USING',
  'ENUM',
  'VALUE',
  'CONSTRAINT',
  'FOREIGN',
  'KEY',
  'REFERENCES',
  'CHECK',
  'NOT',
  'NULL',
  'VALID',
  'DEFAULT',
  'SET',
  'RENAME',
  'TO',
  'TRUNCATE',
  'REINDEX',
  'VACUUM',
  'FULL',
  'BEGIN',
  'COMMIT',
  'LOCK',
  'IN',
  'MODE',
  'UPDATE',
  'INSERT',
  'INTO',
  'VALUES',
  'DO',
  '"users"',
  '"public"."users"',
  'users',
  '`users`',
  '"email"',
  'email',
  'text',
  'int',
  'varchar(255)',
  'now()',
  'gen_random_uuid()',
  "'x'",
  "''",
  "'it''s'",
  '(',
  ')',
  ',',
  ';',
  '.',
  '::',
  '=',
  '$$',
  '$tag$',
  '--',
  '/*',
  '*/',
  '\n',
  '\\',
  '`',
  '${',
  '}',
  "E'\\n'",
]

const sqlLike = fc
  .array(fc.constantFrom(...SQL_TOKENS), { minLength: 1, maxLength: 24 })
  .map((tokens) => tokens.join(' '))

/** A migration whose query() gets `sql` as a template literal, escaped as TypeORM does. */
function migration(sql: string): string {
  const escaped = sql.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${')
  return `import { MigrationInterface, QueryRunner } from 'typeorm'

export class Fuzz1727000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`${escaped}\`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 1')
  }
}
`
}

async function lint(text: string, dialect: 'postgres' | 'mysql' = 'postgres') {
  const config = resolveConfig({ dialect }, 'property test')
  return lintSources([{ path: 'fuzz.ts', text }], config, typeormAdapter)
}

function expectWellFormed(findings: readonly Finding[], text: string) {
  // JavaScript line terminators, which is how Babel numbers lines.
  const lines = text.split(/\r\n|[\n\r\u2028\u2029]/).length
  for (const f of findings) {
    expect(SEVERITIES.has(f.severity)).toBe(true)
    expect(f.file).toBe('fuzz.ts')
    expect(f.line).toBeGreaterThanOrEqual(1)
    expect(f.line).toBeLessThanOrEqual(lines)
    expect(f.column).toBeGreaterThanOrEqual(1)
    expect(f.message).not.toBe('')
  }
}

describe('linting never crashes', () => {
  it('on arbitrary file contents', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ unit: 'binary', maxLength: 400 }), async (text) => {
        expectWellFormed((await lint(text)).findings, text)
      }),
      RUNS,
    )
  })

  it('on near-SQL in a migration, for PostgreSQL', async () => {
    await fc.assert(
      fc.asyncProperty(sqlLike, async (sql) => {
        const text = migration(sql)
        expectWellFormed((await lint(text)).findings, text)
      }),
      RUNS,
    )
  })

  it('on near-SQL in a migration, for MySQL', async () => {
    await fc.assert(
      fc.asyncProperty(sqlLike, async (sql) => {
        const text = migration(sql)
        expectWellFormed((await lint(text, 'mysql')).findings, text)
      }),
      RUNS,
    )
  })

  it('on arbitrary text inside a query() string', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ unit: 'binary', maxLength: 200 }), async (sql) => {
        const text = migration(sql)
        expectWellFormed((await lint(text)).findings, text)
      }),
      RUNS,
    )
  })
})

describe('suppression comments', () => {
  it('parse any comment text without throwing', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 300 }), (text) => {
        const parsed = parseSuppressionComment(text)
        if (parsed !== undefined) expect(['next', 'file']).toContain(parsed.scope)
      }),
      { numRuns: 500 },
    )
  })
})

describe('GitHub annotations', () => {
  const finding = fc.record({
    message: fc.string({ unit: 'binary', maxLength: 80 }),
    file: fc.string({ unit: 'binary', minLength: 1, maxLength: 40 }),
    why: fc.string({ unit: 'binary', maxLength: 40 }),
  })

  it('stay one line each, whatever text a migration puts in a message', () => {
    fc.assert(
      fc.property(fc.array(finding, { maxLength: 5 }), (items) => {
        const findings: Finding[] = items.map((item) => ({
          ruleId: 'no-drop-column',
          severity: 'error',
          category: 'data-loss',
          file: item.file,
          line: 1,
          column: 1,
          message: item.message,
          why: item.why,
          safeAlternative: null,
          docsUrl: 'https://example.com',
          suppressed: null,
        }))
        const summary = {
          errors: findings.length,
          warnings: 0,
          suppressed: 0,
          files: 1,
          migrations: 1,
        }
        const output = formatGithub({ version: '0.0.0', findings, summary }, { pathPrefix: '' })
        const lines = output.split('\n').slice(0, -1)
        expect(lines).toHaveLength(findings.length + 1)
        for (const line of lines.slice(0, -1)) expect(line.startsWith('::error file=')).toBe(true)
      }),
      { numRuns: 500 },
    )
  })
})
