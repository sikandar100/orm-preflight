import type { OperationBody } from '../ir/types.js'

/** One SQL statement and the operations it performs. Offsets are UTF-16 string indexes. */
export interface ParsedStatement {
  /** Index of the statement's first character (after leading whitespace and comments). */
  start: number
  /** Index just after the statement's last character, before any `;`. */
  end: number
  text: string
  ops: OperationBody[]
}

export type SqlParseResult =
  | { ok: true; statements: ParsedStatement[] }
  | { ok: false; message: string; /** UTF-16 index of the error. */ position: number }

/** Parses a string that may hold several statements. Never throws for bad SQL. */
export type SqlParser = (sql: string) => SqlParseResult
