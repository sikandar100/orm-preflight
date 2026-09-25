import type * as t from '@babel/types'
import { parseSuppressionComment } from '../../engine/suppression-comments.js'
import type { ExtractedMigration, Suppression } from '../../ir/types.js'
import type { AdapterContext, OrmAdapter, SourceFile } from '../types.js'
import { typeormConfigSchema } from './config.js'
import { typeormRules } from './rules/index.js'
import { findMigrationClasses, type MigrationClass } from './extract/classes.js'
import { LineIndex } from './extract/lines.js'
import { parseSource, span, unwrap } from './extract/parse.js'
import { Scope } from './extract/scope.js'
import { resolveValue } from './extract/values.js'
import { type SuppressionComment, walkUp } from './extract/walk.js'
import {
  type DeclaredTransaction,
  resolveTransactionMode,
  runsInTransaction,
} from './transaction.js'

export const typeormAdapter: OrmAdapter = {
  id: 'typeorm',
  defaultMigrationGlobs: [
    '**/migrations/*.{ts,js,mjs,cjs}',
    '!**/{node_modules,dist,build,.git}/**',
  ],
  configSchema: typeormConfigSchema,
  extract: extractTypeorm,
  rules: [...typeormRules],
  starterOptions: { transactionMode: 'all' },
  starterNote:
    'Set "typeorm.transactionMode" to the migrationsTransactionMode of your DataSource ("all" is the TypeORM default).',
}

/** Statically extracts every TypeORM migration class from a file. Never runs the file. */
export function extractTypeorm(file: SourceFile, ctx: AdapterContext): ExtractedMigration[] {
  const mode = resolveTransactionMode(ctx.options)
  const lines = new LineIndex(file.text)
  const parsed = parseSource(file.path, file.text)

  if (!parsed.ok) {
    return [
      {
        adapter: 'typeorm',
        file: file.path,
        id: baseName(file.path),
        loc: { file: file.path, line: 1, column: 1 },
        timestamp: null,
        runsInTransaction: 'unknown',
        up: [
          {
            kind: 'operation',
            operation: {
              kind: 'unanalyzable',
              reason: `Could not parse the file: ${parsed.message}`,
              loc: { file: file.path, ...lines.position(parsed.offset) },
              origin: 'builder',
            },
          },
        ],
        downIsEmpty: false,
        suppressions: [],
        adapterData: { parseError: true },
      },
    ]
  }

  const program = parsed.ast.program
  const moduleScope = new Scope()
  moduleScope.declareStatements(program.body)

  // Every `preflight safety-assured` comment in the file. Each migration gets the same list,
  // so a step's suppression indexes mean the same thing everywhere in the file.
  const suppressions: Suppression[] = []
  const comments: SuppressionComment[] = []
  for (const comment of parsed.ast.comments ?? []) {
    const parsedComment = parseSuppressionComment(comment.value)
    if (parsedComment === undefined) continue
    const start = comment.start ?? 0
    const end = comment.end ?? start
    const index = suppressions.length
    suppressions.push({
      ruleId: parsedComment.ruleId,
      reason: parsedComment.reason,
      loc: { file: file.path, ...lines.position(start) },
      scope: parsedComment.scope,
    })
    if (parsedComment.scope === 'next') comments.push({ index, start, end })
  }

  return findMigrationClasses(program).map((migration) => {
    const name = literalString(migration.name, file.text, moduleScope)
    const declared = declaredTransaction(migration.transaction)
    const adapterData: Record<string, unknown> = {}
    if (migration.className !== undefined) adapterData.className = migration.className
    if (name !== undefined) adapterData.name = name
    if (declared !== undefined) adapterData.declaredTransaction = declared

    const loc = { file: file.path, ...lines.position(span(migration.node).start) }
    const up = walkUp(migration.up, {
      file: file.path,
      text: file.text,
      lines,
      dialect: ctx.dialect,
      moduleScope,
      methods: migration.methods,
      comments,
    })
    if (name === null) {
      // TypeORM takes the timestamp from the name at runtime; it cannot be checked here.
      up.unshift({
        kind: 'operation',
        operation: {
          kind: 'unanalyzable',
          reason: 'The migration name is not a constant, so its timestamp cannot be checked',
          loc,
          origin: 'builder',
        },
      })
    }

    return {
      adapter: 'typeorm',
      file: file.path,
      id: migration.className ?? (typeof name === 'string' ? name : baseName(file.path)),
      loc,
      timestamp: timestampOf(migration, name),
      runsInTransaction: runsInTransaction(mode, declared),
      up,
      downIsEmpty: isEmpty(migration.down),
      suppressions,
      adapterData,
    }
  })
}

/** The `name` property: its string value, null when not a constant, or undefined when absent. */
function literalString(
  node: t.Node | undefined,
  text: string,
  scope: Scope,
): string | null | undefined {
  if (node === undefined) return undefined
  const value = resolveValue(node, text, scope)
  return value.kind === 'string' ? value.value : null
}

function declaredTransaction(node: t.Node | undefined): DeclaredTransaction {
  if (node === undefined) return undefined
  const n = unwrap(node)
  return n.type === 'BooleanLiteral' ? n.value : 'unknown'
}

/**
 * TypeORM takes the timestamp from the last 13 characters of the `name` property, or of
 * the class name when `name` is not set (MigrationExecutor.getMigrations).
 */
function timestampOf(migration: MigrationClass, name: string | null | undefined): number | null {
  if (name === null) return null
  const source = name ?? migration.className
  if (source === undefined) return null
  const timestamp = parseInt(source.slice(-13), 10)
  return Number.isNaN(timestamp) || timestamp === 0 ? null : timestamp
}

function isEmpty(fn: MigrationClass['down']): boolean {
  if (fn === undefined) return true
  if (fn.body.type !== 'BlockStatement') return false
  return fn.body.body.every((s) => s.type === 'EmptyStatement')
}

function baseName(path: string): string {
  const last = path.split(/[\\/]/).pop() ?? path
  return last.replace(/\.[^.]+$/, '')
}
