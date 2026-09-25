import type { Loc, SqlSourceMap } from './types.js'

/** Returns the source location of the character at `offset` in an extracted SQL string. */
export function locateSql(map: SqlSourceMap, offset: number): Loc {
  const [first] = map.runs
  if (first === undefined) throw new Error('SQL source map has no runs')

  // Binary search for the last run that starts at or before `offset`.
  let found = first
  let low = 0
  let high = map.runs.length - 1
  while (low <= high) {
    const mid = (low + high) >> 1
    const run = map.runs[mid]
    if (run === undefined) break
    if (run.offset <= offset) {
      found = run
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return {
    file: map.file,
    line: found.line,
    column: found.column + Math.max(0, offset - found.offset),
  }
}
