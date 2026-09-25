import { getAdapter } from './adapters/index.js'
import { type LintOptions, type LintResult, runLint } from './lint.js'

export type { LintOptions, LintResult, LintSummary } from './lint.js'
export type { Category, Finding } from './rules/types.js'
export { formatJson } from './reporters/json.js'
export { version } from './version.js'

/** Lints migration files. Resolves with the findings; throws UsageError for bad input or config. */
export function lint(options: LintOptions = {}): Promise<LintResult> {
  return runLint(options, { get: getAdapter })
}

export { ConfigError, UsageError } from './errors.js'
