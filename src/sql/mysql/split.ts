/**
 * Splits MySQL text into statements at semicolons outside strings, quoted identifiers,
 * and comments. The MySQL parser does not report where each statement starts, so positions
 * come from here. Returned offsets skip leading whitespace and comments.
 */
export function splitStatements(sql: string): { start: number; end: number }[] {
  const statements: { start: number; end: number }[] = []
  let begin = 0
  let i = 0

  const push = (end: number) => {
    const start = skipTrivia(sql, begin, end)
    let stop = end
    while (stop > start && /\s/.test(sql.charAt(stop - 1))) stop--
    if (stop > start) statements.push({ start, end: stop })
  }

  while (i < sql.length) {
    const ch = sql.charAt(i)
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipQuoted(sql, i, ch)
    } else if (isLineComment(sql, i)) {
      const newline = sql.indexOf('\n', i)
      i = newline === -1 ? sql.length : newline + 1
    } else if (sql.startsWith('/*', i)) {
      const close = sql.indexOf('*/', i + 2)
      i = close === -1 ? sql.length : close + 2
    } else if (ch === ';') {
      push(i)
      begin = i + 1
      i++
    } else {
      i++
    }
  }
  push(sql.length)
  return statements
}

/** `#`, or `--` followed by whitespace or the end, as MySQL defines comments. */
function isLineComment(sql: string, i: number): boolean {
  if (sql.charAt(i) === '#') return true
  return sql.startsWith('--', i) && (i + 2 >= sql.length || /\s/.test(sql.charAt(i + 2)))
}

/** Index after a quoted string or identifier. Doubled quotes and backslashes escape. */
function skipQuoted(sql: string, from: number, quote: string): number {
  let i = from + 1
  while (i < sql.length) {
    const ch = sql.charAt(i)
    if (ch === '\\' && quote !== '`') i += 2
    else if (ch === quote && sql.charAt(i + 1) === quote) i += 2
    else if (ch === quote) return i + 1
    else i++
  }
  return sql.length
}

function skipTrivia(sql: string, from: number, limit: number): number {
  let i = from
  while (i < limit) {
    if (/\s/.test(sql.charAt(i))) i++
    else if (isLineComment(sql, i)) {
      const newline = sql.indexOf('\n', i)
      i = newline === -1 ? limit : newline + 1
    } else if (sql.startsWith('/*', i)) {
      const close = sql.indexOf('*/', i + 2)
      i = close === -1 ? limit : close + 2
    } else break
  }
  return i
}
