import type { LintResult } from '../../src/lint.js'
import type { Finding } from '../../src/rules/types.js'

export const finding = (overrides: Partial<Finding>): Finding => ({
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

/** One error, one warning without a safe alternative, one suppressed finding. */
export const result: LintResult = {
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
      docsUrl:
        'https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/unanalyzable-statement.md',
    }),
    finding({
      file: 'src/migrations/1727700000000-Drop.ts',
      suppressed: { reason: 'unused since 2.3' },
    }),
  ],
  summary: { errors: 1, warnings: 1, suppressed: 1, files: 2, migrations: 2 },
}
