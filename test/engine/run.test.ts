import { describe, expect, it } from 'vitest'
import type { AnalyzedMigration, Operation } from '../../src/ir/types.js'
import { runRules, type EngineOptions } from '../../src/engine/run.js'
import type { Rule } from '../../src/rules/types.js'

const loc = (line: number, file = 'm.ts') => ({ file, line, column: 1 })

function migration(up: Operation[], extra: Partial<AnalyzedMigration> = {}): AnalyzedMigration {
  return {
    adapter: 'typeorm',
    file: 'm.ts',
    id: 'M1',
    loc: loc(1),
    timestamp: 1,
    runsInTransaction: true,
    up,
    downIsEmpty: false,
    suppressions: [],
    ...extra,
  }
}

const drop = (line: number, name = 'users', file = 'm.ts'): Operation => ({
  kind: 'drop_table',
  table: { schema: 'public', name },
  loc: loc(line, file),
  origin: 'sql',
})

function rule(id: string, overrides: Partial<Rule['meta']> = {}, downgrade = false): Rule {
  return {
    meta: {
      id,
      category: 'data-loss',
      defaultSeverity: 'error',
      dialects: ['postgres'],
      docsUrl: `https://example.com/${id}`,
      ...overrides,
    },
    check: (m) =>
      m.up.flatMap((op) =>
        op.kind === 'drop_table'
          ? [
              {
                op,
                target: { table: op.table },
                message: `m ${op.table.name}`,
                why: 'w',
                downgrade,
              },
            ]
          : [],
      ),
  }
}

const options: EngineOptions = {
  dialect: 'postgres',
  pgVersion: 16,
  severities: {},
  adapterOptions: {},
  defaultSchema: 'public',
}

describe('runRules', () => {
  it('builds public findings with every field present', () => {
    expect(runRules([migration([drop(3)])], [rule('r')], options)).toEqual([
      {
        ruleId: 'r',
        severity: 'error',
        category: 'data-loss',
        file: 'm.ts',
        line: 3,
        column: 1,
        message: 'm users',
        why: 'w',
        safeAlternative: null,
        docsUrl: 'https://example.com/r',
        suppressed: null,
      },
    ])
  })

  it('applies severity overrides, turns rules off, and honours downgrades', () => {
    const m = [migration([drop(3)])]
    expect(runRules(m, [rule('r')], { ...options, severities: { r: 'warn' } })[0]?.severity).toBe(
      'warn',
    )
    expect(runRules(m, [rule('r')], { ...options, severities: { r: 'off' } })).toEqual([])
    expect(runRules(m, [rule('r', {}, true)], options)[0]?.severity).toBe('warn')
  })

  it('skips rules for other dialects and newer PostgreSQL versions', () => {
    const m = [migration([drop(3)])]
    expect(runRules(m, [rule('r', { dialects: ['mysql'] })], options)).toEqual([])
    expect(runRules(m, [rule('r', { minPgVersion: 17 })], options)).toEqual([])
    expect(runRules(m, [rule('r', { minPgVersion: 16 })], options)).toHaveLength(1)
  })

  it('skips tables created in the same migration, or in the run when asked', () => {
    const create: Operation = {
      kind: 'create_table',
      table: { schema: 'public', name: 'users' },
      loc: loc(2),
      origin: 'sql',
    }
    expect(runRules([migration([create, drop(3)])], [rule('r')], options)).toEqual([])
    const two = [migration([create]), migration([drop(3)], { file: 'n.ts' })]
    expect(runRules(two, [rule('r')], options)).toHaveLength(1)
    expect(
      runRules(two, [rule('r')], { ...options, changes: { ref: 'main', files: new Map() } }),
    ).toEqual([])
  })

  it('keeps new-table findings for categories that are about the statement itself', () => {
    const create: Operation = {
      kind: 'create_table',
      table: { schema: 'public', name: 'users' },
      loc: loc(2),
      origin: 'sql',
    }
    const findings = runRules(
      [migration([create, drop(3)])],
      [rule('r', { category: 'correctness' })],
      options,
    )
    expect(findings).toHaveLength(1)
  })

  it('hides superseded findings on the same target', () => {
    const findings = runRules(
      [migration([drop(3)])],
      [rule('general'), rule('specific', { supersedes: ['general'] })],
      options,
    )
    expect(findings.map((f) => f.ruleId)).toEqual(['specific'])
  })

  it('reports a file-level problem once, even when several migrations share the file', () => {
    const shared: Rule = {
      meta: {
        id: 's',
        category: 'correctness',
        defaultSeverity: 'error',
        dialects: ['postgres'],
        docsUrl: 'u',
      },
      check: () => [{ loc: loc(1), message: 'once', why: 'w' }],
    }
    expect(runRules([migration([]), migration([], { id: 'M2' })], [shared], options)).toHaveLength(
      1,
    )
  })

  it('sorts by file, line, column, and rule', () => {
    const findings = runRules(
      [migration([drop(9), drop(2, 'a')]), migration([drop(1, 'b', 'a.ts')], { file: 'a.ts' })],
      [rule('z'), rule('a', { supersedes: [] })],
      options,
    )
    expect(findings.map((f) => `${f.file}:${String(f.line)}:${f.ruleId}`)).toEqual([
      'a.ts:1:a',
      'a.ts:1:z',
      'm.ts:2:a',
      'm.ts:2:z',
      'm.ts:9:a',
      'm.ts:9:z',
    ])
  })

  it('notes when the operation runs only on some code paths', () => {
    const op = { ...drop(3), conditional: true }
    expect(runRules([migration([op])], [rule('r')], options)[0]?.message).toBe(
      'm users It runs only on some code paths (inside a condition, loop, or callback).',
    )
  })

  it('applies only valid suppressions', () => {
    const suppressions = [
      { ruleId: 'r', reason: '', loc: loc(2), scope: 'next' as const },
      { ruleId: 'r', reason: 'checked by hand', loc: loc(2), scope: 'next' as const },
    ]
    const op = { ...drop(3), suppressions: [0] }
    expect(
      runRules([migration([op], { suppressions })], [rule('r')], options)[0]?.suppressed,
    ).toBeNull()
    const op2 = { ...drop(3), suppressions: [1] }
    expect(
      runRules([migration([op2], { suppressions })], [rule('r')], options)[0]?.suppressed,
    ).toEqual({
      reason: 'checked by hand',
    })
  })
})
