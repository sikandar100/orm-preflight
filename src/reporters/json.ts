import type { LintResult } from '../lint.js'

/**
 * The JSON output format. Public API, documented in docs/json-output.md. Every field is
 * always present and keys have a fixed order, so the same input gives byte-identical output.
 */
export function formatJson(result: LintResult): string {
  const output = {
    version: result.version,
    summary: {
      errors: result.summary.errors,
      warnings: result.summary.warnings,
      suppressed: result.summary.suppressed,
      files: result.summary.files,
      migrations: result.summary.migrations,
    },
    findings: result.findings.map((f) => ({
      ruleId: f.ruleId,
      severity: f.severity,
      category: f.category,
      file: f.file,
      line: f.line,
      column: f.column,
      message: f.message,
      why: f.why,
      safeAlternative: f.safeAlternative,
      docsUrl: f.docsUrl,
      suppressed: f.suppressed === null ? null : { reason: f.suppressed.reason },
    })),
  }
  return `${JSON.stringify(output, null, 2)}\n`
}
