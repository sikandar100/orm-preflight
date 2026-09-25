import { createColors } from 'picocolors'
import type { LintResult } from '../lint.js'
import type { Finding } from '../rules/types.js'

export interface PrettyOptions {
  color: boolean
  /** Set when warnings over this number fail the run, to explain the exit code. */
  maxWarnings?: number | undefined
}

/**
 * The human-readable format: findings grouped by file, each with what happens, why, the safe
 * alternative, and the docs link, then a summary line. Suppressed findings are only counted;
 * the JSON format lists them.
 */
export function formatPretty(result: LintResult, options: PrettyOptions): string {
  const c = createColors(options.color)
  const shown = result.findings.filter((f) => f.suppressed === null)
  const byFile = new Map<string, Finding[]>()
  for (const f of shown) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f])

  const out: string[] = []
  for (const [file, findings] of byFile) {
    out.push(c.underline(file))
    const locWidth = Math.max(...findings.map((f) => location(f).length))
    const indent = ' '.repeat(2 + locWidth + 2)
    for (const f of findings) {
      const severity = f.severity === 'error' ? c.red('error') : c.yellow('warn ')
      out.push(`  ${c.dim(location(f).padEnd(locWidth))}  ${severity}  ${c.bold(f.ruleId)}`)
      out.push(`${indent}${f.message}`)
      out.push(`${indent}${c.dim('Why: ')} ${f.why}`)
      if (f.safeAlternative !== null) out.push(`${indent}${c.dim('Safe:')} ${f.safeAlternative}`)
      out.push(`${indent}${c.dim('Docs:')} ${f.docsUrl}`)
      out.push('')
    }
  }

  const { errors, warnings, suppressed, migrations } = result.summary
  let summary = `${count(errors, 'error')}, ${count(warnings, 'warning')} in ${count(migrations, 'migration')}`
  if (suppressed > 0) summary += ` (${String(suppressed)} suppressed)`
  out.push(
    errors > 0 ? c.red(c.bold(summary)) : warnings > 0 ? c.yellow(summary) : c.green(summary),
  )
  if (options.maxWarnings !== undefined && warnings > options.maxWarnings) {
    out.push(
      c.red(
        `Too many warnings: ${String(warnings)}, and --max-warnings is ${String(options.maxWarnings)}.`,
      ),
    )
  }
  return `${out.join('\n')}\n`
}

function location(f: Finding): string {
  return `${String(f.line)}:${String(f.column)}`
}

function count(n: number, noun: string): string {
  return `${String(n)} ${noun}${n === 1 ? '' : 's'}`
}
