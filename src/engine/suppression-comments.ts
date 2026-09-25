export interface ParsedSuppression {
  scope: 'next' | 'file'
  /** Empty when the comment names no rule. */
  ruleId: string
  /** Empty when the comment gives no reason. */
  reason: string
}

/**
 * Reads a `preflight safety-assured <rule-id> -- <reason>` comment (or the `-file` form).
 * Returns undefined for any other comment. Parsed with plain string operations: comments
 * come from untrusted migration files.
 */
export function parseSuppressionComment(value: string): ParsedSuppression | undefined {
  // Block comments may carry JSDoc-style leading asterisks.
  const text = value
    .split('\n')
    .map((line) => line.replace(/^\s*\*?/, ''))
    .join(' ')
    .trim()
  const words = text.split(/\s+/)
  if (words[0] !== 'preflight') return undefined
  const marker = words[1]
  if (marker !== 'safety-assured' && marker !== 'safety-assured-file') return undefined

  const rest = text.slice(text.indexOf(marker) + marker.length).trim()
  const separator = rest.startsWith('--') ? 0 : rest.indexOf(' --')
  const ruleId = (separator === -1 ? rest : rest.slice(0, separator)).trim()
  const reason = separator === -1 ? '' : rest.slice(separator + (separator === 0 ? 2 : 3)).trim()
  return { scope: marker === 'safety-assured-file' ? 'file' : 'next', ruleId, reason }
}
