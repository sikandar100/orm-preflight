import { locateSql } from '../ir/locate.js'
import { defaultSchemaFor, normalizeOperation, type NormalizeOptions } from '../ir/normalize.js'
import type { AnalyzedMigration, ExtractedMigration, Operation } from '../ir/types.js'
import type { Dialect } from '../rules/types.js'
import type { SqlParser } from './types.js'

export interface ParseOptions {
  dialect: Dialect
  /** Defaults to `public` for PostgreSQL and none for MySQL. */
  defaultSchema?: string
}

/** Loads the parser for a dialect. Each parser is loaded on first use only. */
export async function loadParser(dialect: Dialect): Promise<SqlParser> {
  if (dialect === 'postgres') {
    const { loadPostgresParser } = await import('./postgres/parse.js')
    return loadPostgresParser()
  }
  const { loadMysqlParser } = await import('./mysql/parse.js')
  return loadMysqlParser()
}

/**
 * The core parse stage: turns every SQL step into operations located at their statement,
 * and normalizes table and type names on every operation, whether it came from SQL or a
 * builder call.
 */
export async function parseMigrations(
  migrations: readonly ExtractedMigration[],
  options: ParseOptions,
): Promise<AnalyzedMigration[]> {
  const hasSql = migrations.some((m) => m.up.some((s) => s.kind === 'sql'))
  const parse = hasSql ? await loadParser(options.dialect) : undefined
  const normalize: NormalizeOptions = {
    dialect: options.dialect,
    defaultSchema: options.defaultSchema ?? defaultSchemaFor(options.dialect),
  }

  return migrations.map(({ up, ...migration }) => ({
    ...migration,
    up: up.flatMap((step): Operation[] => {
      if (step.kind === 'operation') {
        const { loc, origin, conditional, ...body } = step.operation
        return [
          {
            ...normalizeOperation(body as Operation, normalize),
            loc,
            origin,
            ...(conditional === true ? { conditional } : {}),
          },
        ]
      }

      if (parse === undefined) throw new Error('The SQL parser was not loaded')
      const flags = step.conditional === true ? { conditional: true } : {}
      const result = parse(step.sql)
      if (!result.ok) {
        return [
          {
            kind: 'unanalyzable',
            reason: `Could not parse the SQL: ${result.message}`,
            loc: locateSql(step.map, result.position),
            origin: 'sql',
            sql: step.sql,
            ...flags,
          },
        ]
      }
      const size = result.statements.length
      return result.statements.flatMap((statement, index) =>
        statement.ops.map((body): Operation => ({
          ...normalizeOperation(body, normalize),
          loc: locateSql(step.map, statement.start),
          origin: 'sql',
          sql: statement.text,
          ...flags,
          ...(size > 1 ? { batch: { index, size } } : {}),
        })),
      )
    }),
  }))
}
