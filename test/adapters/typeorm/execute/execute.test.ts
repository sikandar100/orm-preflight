import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { extractTypeorm, typeormAdapter } from '../../../../src/adapters/typeorm/index.js'
import { runMigrations } from '../../../../src/adapters/typeorm/execute/index.js'
import { resolveConfig } from '../../../../src/config/load.js'
import { lintSources } from '../../../../src/lint.js'

/** --execute: runs each migration's up() with a recording QueryRunner (SPEC 5.4). */
const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url))

async function lint(file: string, options: { execute: boolean; dialect?: 'postgres' | 'mysql' }) {
  const text = readFileSync(path.join(fixtures, file), 'utf8')
  const config = resolveConfig({ dialect: options.dialect ?? 'postgres' }, 'test')
  return lintSources(
    [{ path: file, text }],
    config,
    typeormAdapter,
    undefined,
    options.execute ? { cwd: fixtures } : undefined,
  )
}

const summary = (findings: { ruleId: string; line: number; message: string }[]) =>
  findings.map((f) => `${String(f.line)} ${f.ruleId}`)

describe('--execute', () => {
  it('sees SQL that is only built at run time, including through imported helpers', async () => {
    const statically = await lint('1727000000001-Dynamic.ts', { execute: false })
    expect(summary(statically.findings)).toEqual([
      '8 unanalyzable-statement',
      '10 no-add-not-null-without-default',
    ])

    const executed = await lint('1727000000001-Dynamic.ts', { execute: true })
    expect(summary(executed.findings)).toEqual([
      '8 require-concurrent-index',
      '8 require-concurrent-index',
      '10 no-add-not-null-without-default',
    ])
    const indexes = executed.findings.filter((f) => f.ruleId === 'require-concurrent-index')
    expect(indexes.map((f) => f.message)).toEqual([
      // Findings on the same line are sorted by message, so the output is always the same.
      expect.stringContaining('"IDX_invoices_tenant"'),
      expect.stringContaining('"IDX_orders_tenant"'),
    ])
  })

  it('reports reads from the database, since a real database may change what runs', async () => {
    const result = await lint('1727000000002-Reads.ts', { execute: true })
    expect(summary(result.findings)).toEqual(['5 unanalyzable-statement'])
    expect(result.findings[0]?.message).toContain('up() reads the database with hasColumn()')
  })

  it('keeps what ran before up() failed, and reports the failure', async () => {
    const result = await lint('1727000000003-Throws.ts', { execute: true })
    const messages = result.findings.map((f) => f.message)
    expect(messages).toContainEqual(expect.stringContaining('up() failed while running: boom'))
  })

  it('reports a file that fails to load', async () => {
    const result = await lint('1727000000004-LoadFails.ts', { execute: true })
    expect(result.findings.map((f) => f.message)).toContainEqual(
      expect.stringContaining('Running the file failed: cannot load'),
    )
  })

  it('gives up on an up() that never finishes', async () => {
    const file = '1727000000005-Hangs.ts'
    const text = readFileSync(path.join(fixtures, file), 'utf8')
    const ctx = { dialect: 'postgres' as const, options: {} }
    const statics = extractTypeorm({ path: file, text }, ctx)
    const [migration] = await runMigrations(
      { path: file, text },
      path.join(fixtures, file),
      ctx,
      statics,
      50,
    )
    const reasons = (migration?.up ?? []).map((s) =>
      s.kind === 'operation' && s.operation.kind === 'unanalyzable' ? s.operation.reason : s.kind,
    )
    expect(reasons).toEqual([
      'sql',
      'up() failed while running: it did not finish within 0.05 seconds',
    ])
  })

  it('applies suppression comments to the statements they precede', async () => {
    const result = await lint('1727000000006-Suppressed.ts', { execute: true })
    expect(result.findings.map((f) => [f.ruleId, f.suppressed])).toEqual([
      ['no-drop-column', { reason: 'bio was removed from the entity in 2.3' }],
    ])
  })

  it('runs CommonJS migrations', async () => {
    const result = await lint('1727000000007-CommonJs.js', { execute: true })
    expect(summary(result.findings)).toEqual(['4 no-drop-table'])
  })

  it.each(['postgres', 'mysql'] as const)('answers the database type as %s', async (dialect) => {
    const result = await lint('1727000000008-Branches.ts', { execute: true, dialect })
    expect(summary(result.findings)).toEqual([
      `${dialect === 'postgres' ? '7' : '8'} no-drop-table`,
    ])
  })

  it('follows transactions the migration ends and starts itself', async () => {
    const result = await lint('1727000000009-LeavesTransaction.ts', { execute: true })
    expect(summary(result.findings)).toEqual([])
  })
})

describe('static mode', () => {
  const marker = path.join(tmpdir(), `orm-preflight-marker-${String(process.pid)}`)
  afterEach(() => {
    rmSync(marker, { force: true })
    delete process.env.ORM_PREFLIGHT_MARKER
  })

  it('never runs a migration file, and --execute does', async () => {
    process.env.ORM_PREFLIGHT_MARKER = marker
    await lint('1727000000010-SideEffect.ts', { execute: false })
    expect(existsSync(marker)).toBe(false)
    await lint('1727000000010-SideEffect.ts', { execute: true })
    expect(existsSync(marker)).toBe(true)
  })
})
