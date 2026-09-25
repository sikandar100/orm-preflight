import type { OperationBody } from '../../ir/types.js'
import { codePointToIndex, Utf8Offsets } from '../offsets.js'
import type { ParsedStatement, SqlParser } from '../types.js'
import { mapStatement } from './map.js'

export type { SqlParser } from '../types.js'

type LibPgQuery = typeof import('libpg-query')

let loading: Promise<LibPgQuery> | undefined

/** Loads the PostgreSQL parser (WebAssembly) once, on first use. */
async function loadLibrary(): Promise<LibPgQuery> {
  loading ??= import('libpg-query').then(async (lib) => {
    await lib.loadModule()
    return lib
  })
  return loading
}

/** Returns a synchronous parser backed by the real PostgreSQL grammar. */
export async function loadPostgresParser(): Promise<SqlParser> {
  const lib = await loadLibrary()
  return (sql) => {
    // PostgreSQL accepts an empty query and does nothing; the WebAssembly parser throws.
    if (sql.trim() === '') return { ok: true, statements: [] }
    let result: ReturnType<LibPgQuery['parseSync']>
    try {
      result = lib.parseSync(sql)
    } catch (error) {
      const details = (error as { sqlDetails?: { cursorPosition?: number } }).sqlDetails
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
        position: codePointToIndex(sql, details?.cursorPosition ?? 0),
      }
    }

    const offsets = new Utf8Offsets(sql)
    const total = Buffer.byteLength(sql, 'utf8')
    const statements: ParsedStatement[] = []
    for (const raw of result.stmts ?? []) {
      // PostgreSQL omits zero values: a missing location is 0, a missing length runs to the end.
      const startByte = raw.stmt_location ?? 0
      const endByte =
        raw.stmt_len === undefined || raw.stmt_len === 0 ? total : startByte + raw.stmt_len
      // PostgreSQL reports the position of the statement's first token.
      const start = offsets.toIndex(startByte)
      const end = trimEnd(sql, offsets.toIndex(endByte))
      const ops: OperationBody[] =
        raw.stmt === undefined ? [] : mapStatement(raw.stmt, { sql, offsets, end })
      statements.push({ start, end, text: sql.slice(start, end), ops })
    }
    return { ok: true, statements }
  }
}

/** Moves an end index back over trailing whitespace and a final semicolon. */
function trimEnd(sql: string, end: number): number {
  let i = end
  while (i > 0 && /[\s;]/.test(sql.charAt(i - 1))) i--
  return i
}
