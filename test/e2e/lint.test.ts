import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { formatJson, lint, UsageError, version } from '../../src/index.js'

let dir: string

function write(file: string, text: string) {
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
  writeFileSync(path.join(dir, file), text)
}

const migration = (
  name: string,
  ts: number,
  sql: string,
) => `import { MigrationInterface, QueryRunner } from 'typeorm'

export class ${name}${String(ts)} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`${sql}\`)
  }

  public async down(): Promise<void> {}
}
`

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'orm-preflight-lint-'))
  write(
    'src/migrations/1727000000000-Old.ts',
    migration('Old', 1727000000000, 'DROP TABLE "legacy"'),
  )
  write(
    'src/migrations/1727600000000-DropBio.ts',
    migration('DropBio', 1727600000000, 'ALTER TABLE "users" DROP COLUMN "bio"'),
  )
  // Compiled copies and dependencies must never be linted.
  write('dist/migrations/1727600000000-DropBio.js', 'this would be linted twice')
  write('node_modules/pkg/migrations/1.ts', 'not ours')
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('lint', () => {
  it('finds migrations in the default location and reports findings', async () => {
    const result = await lint({ cwd: dir })
    expect(result.version).toBe(version)
    expect(result.summary).toEqual({
      errors: 2,
      warnings: 0,
      suppressed: 0,
      files: 2,
      migrations: 2,
    })
    expect(result.findings.map((f) => `${f.file}:${String(f.line)} ${f.ruleId}`)).toEqual([
      'src/migrations/1727000000000-Old.ts:5 no-drop-table',
      'src/migrations/1727600000000-DropBio.ts:5 no-drop-column',
    ])
  })

  it('ignores migrations at or before startAfter', async () => {
    write('orm-preflight.config.json', JSON.stringify({ startAfter: 1727000000000 }))
    const result = await lint({ cwd: dir })
    expect(result.findings.map((f) => f.ruleId)).toEqual(['no-drop-column'])
    expect(result.summary.migrations).toBe(1)
  })

  it('lints explicit files and globs, and respects rule severities from package.json', async () => {
    write('package.json', JSON.stringify({ ormPreflight: { rules: { 'no-drop-column': 'warn' } } }))
    const result = await lint({ cwd: dir, patterns: ['src/migrations/*-DropBio.ts'] })
    expect(result.summary).toMatchObject({ errors: 0, warnings: 1, files: 1 })
  })

  it('fails with a usage error when nothing matches', async () => {
    await expect(lint({ cwd: dir, patterns: ['nope/*.ts'] })).rejects.toThrow(
      new UsageError('No migration files matched: nope/*.ts'),
    )
  })

  it('produces byte-identical JSON on every run', async () => {
    const first = formatJson(await lint({ cwd: dir }))
    const second = formatJson(await lint({ cwd: dir }))
    expect(second).toBe(first)
    const parsed = JSON.parse(first) as { findings: Record<string, unknown>[] }
    expect(Object.keys(parsed)).toEqual(['version', 'summary', 'findings'])
    expect(Object.keys(parsed.findings[0] ?? {})).toEqual([
      'ruleId',
      'severity',
      'category',
      'file',
      'line',
      'column',
      'message',
      'why',
      'safeAlternative',
      'docsUrl',
      'suppressed',
    ])
  })
})
