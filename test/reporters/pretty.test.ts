import { describe, expect, it } from 'vitest'
import type { LintResult } from '../../src/lint.js'
import { formatPretty } from '../../src/reporters/pretty.js'
import type { Finding } from '../../src/rules/types.js'

const finding = (overrides: Partial<Finding>): Finding => ({
  ruleId: 'no-drop-column',
  severity: 'error',
  category: 'data-loss',
  file: 'src/migrations/1727600000000-DropBio.ts',
  line: 5,
  column: 30,
  message: '"users"."bio" is dropped, which deletes every value in it.',
  why: 'Dropping a column deletes its data immediately.',
  safeAlternative: 'Drop the column in a later release.',
  docsUrl: 'https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-drop-column.md',
  suppressed: null,
  ...overrides,
})

const result: LintResult = {
  version: '0.0.0',
  findings: [
    finding({}),
    finding({
      ruleId: 'unanalyzable-statement',
      severity: 'warn',
      category: 'correctness',
      line: 12,
      column: 5,
      message: 'This statement could not be analyzed.',
      safeAlternative: null,
    }),
    finding({ file: 'src/migrations/1727700000000-Drop.ts', suppressed: { reason: 'unused' } }),
    finding({ file: 'src/migrations/1727800000000-Table.ts', ruleId: 'no-drop-table' }),
  ],
  summary: { errors: 2, warnings: 1, suppressed: 1, files: 3, migrations: 3 },
}

describe('formatPretty', () => {
  it('groups findings by file and hides suppressed ones', async () => {
    await expect(formatPretty(result, { color: false })).toMatchFileSnapshot(
      './__snapshots__/pretty.txt',
    )
  })

  it('colors the output when asked', async () => {
    await expect(formatPretty(result, { color: true })).toMatchFileSnapshot(
      './__snapshots__/pretty-color.txt',
    )
  })

  it('explains a failure caused by --max-warnings', () => {
    expect(formatPretty(result, { color: false, maxWarnings: 0 })).toMatch(
      /Too many warnings: 1, and --max-warnings is 0\.\n$/,
    )
    expect(formatPretty(result, { color: false, maxWarnings: 1 })).not.toContain('Too many')
  })

  it('prints only the summary when there is nothing to report', () => {
    const clean = {
      ...result,
      findings: [],
      summary: { ...result.summary, errors: 0, warnings: 0, suppressed: 0, migrations: 1 },
    }
    expect(formatPretty(clean, { color: false })).toBe('0 errors, 0 warnings in 1 migration\n')
  })
})
