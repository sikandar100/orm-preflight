import type { ParsedStatement, SqlParser } from '../types.js'
import { mapStatement, type MysqlAst } from './map.js'
import { splitStatements } from './split.js'

/** node-sql-parser is an optional peer dependency, needed only for the MySQL dialect. */
export class MissingParserError extends Error {
  constructor() {
    super(
      'MySQL support needs the node-sql-parser package. Install it with: npm install --save-dev node-sql-parser',
    )
    this.name = 'MissingParserError'
  }
}

interface MysqlParserInstance {
  astify(sql: string, options: { database: string }): MysqlAst | MysqlAst[]
}

type ParserClass = new () => MysqlParserInstance

/**
 * Creates a loader that imports node-sql-parser's MySQL grammar once. A missing package
 * becomes MissingParserError; a failed import is retried on the next call.
 */
export function createMysqlLoader(importer: () => Promise<unknown>): () => Promise<ParserClass> {
  let loading: Promise<ParserClass> | undefined
  return () => {
    loading ??= importer().then(
      (mod) => {
        const m = mod as { Parser?: unknown; default?: { Parser?: unknown } }
        return (m.Parser ?? m.default?.Parser) as ParserClass
      },
      (error: unknown) => {
        loading = undefined
        const code = (error as { code?: unknown }).code
        if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
          throw new MissingParserError()
        }
        throw error
      },
    )
    return loading
  }
}

const loadLibrary = createMysqlLoader(() => import('node-sql-parser/build/mysql.js'))

const TRANSACTION = /^(start\s+transaction|begin(\s+work)?|commit(\s+work)?|rollback(\s+work)?)$/i

/** Returns a synchronous MySQL parser. Throws MissingParserError when it is not installed. */
export async function loadMysqlParser(): Promise<SqlParser> {
  const Parser = await loadLibrary()
  const parser = new Parser()
  return (sql) => {
    const statements: ParsedStatement[] = []
    for (const { start, end } of splitStatements(sql)) {
      const text = sql.slice(start, end)
      const transaction = TRANSACTION.exec(text)?.[1]?.toLowerCase()
      if (transaction !== undefined) {
        const action: 'start' | 'commit' | 'rollback' = transaction.startsWith('commit')
          ? 'commit'
          : transaction.startsWith('rollback')
            ? 'rollback'
            : 'start'
        statements.push({ start, end, text, ops: [{ kind: 'transaction_control', action }] })
        continue
      }
      let ast: MysqlAst | MysqlAst[]
      try {
        ast = parser.astify(text, { database: 'MySQL' })
      } catch (error) {
        const offset = (error as { location?: { start?: { offset?: number } } }).location?.start
          ?.offset
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          position: start + (offset ?? 0),
        }
      }
      const ops = (Array.isArray(ast) ? ast : [ast]).flatMap(mapStatement)
      statements.push({ start, end, text, ops })
    }
    return { ok: true, statements }
  }
}
