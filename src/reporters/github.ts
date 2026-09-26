import type { LintResult } from '../lint.js'

export interface GithubOptions {
  /**
   * The linted directory relative to the repository root, with forward slashes, or '' when
   * they are the same. Annotations need paths from the repository root.
   */
  pathPrefix: string
}

/**
 * GitHub Actions workflow commands: one `::error` or `::warning` annotation per finding,
 * shown on the pull request at the exact line, then a summary line. Suppressed findings are
 * not annotated. GitHub shows at most 10 annotations of each level per step; the summary
 * line always counts every finding.
 */
export function formatGithub(result: LintResult, options: GithubOptions): string {
  const lines: string[] = []
  for (const f of result.findings) {
    if (f.suppressed !== null) continue
    const file = options.pathPrefix === '' ? f.file : `${options.pathPrefix}/${f.file}`
    const properties = [
      `file=${escapeProperty(file)}`,
      `line=${String(f.line)}`,
      `col=${String(f.column)}`,
      `title=${escapeProperty(`orm-preflight: ${f.ruleId}`)}`,
    ].join(',')
    const details = [f.message, `Why: ${f.why}`]
    if (f.safeAlternative !== null) details.push(`Safe: ${f.safeAlternative}`)
    details.push(`Docs: ${f.docsUrl}`)
    const command = f.severity === 'error' ? 'error' : 'warning'
    lines.push(`::${command} ${properties}::${escapeData(details.join('\n'))}`)
  }
  const { errors, warnings, suppressed, migrations } = result.summary
  let summary = `orm-preflight: ${count(errors, 'error')}, ${count(warnings, 'warning')} in ${count(migrations, 'migration')}`
  if (suppressed > 0) summary += ` (${String(suppressed)} suppressed)`
  lines.push(summary)
  return `${lines.join('\n')}\n`
}

/** Escaping from @actions/core's command.ts, so text can never end or forge a command. */
function escapeData(text: string): string {
  return text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
}

function escapeProperty(text: string): string {
  return escapeData(text).replaceAll(':', '%3A').replaceAll(',', '%2C')
}

function count(n: number, noun: string): string {
  return `${String(n)} ${noun}${n === 1 ? '' : 's'}`
}
