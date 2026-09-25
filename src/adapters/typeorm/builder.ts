import type { ConstraintType, OperationBody, TableRef } from '../../ir/types.js'
import type { Dialect } from '../../rules/types.js'
import { isVolatileDefault } from '../../sql/volatility.js'
import type { Value } from './extract/values.js'

/** QueryRunner methods that only read. They produce no operation. */
export const READ_METHODS: ReadonlySet<string> = new Set([
  'getTable',
  'getTables',
  'getView',
  'getViews',
  'hasTable',
  'hasColumn',
  'hasSchema',
  'hasDatabase',
  'hasEnumType',
  'getDatabases',
  'getSchemas',
  'getCurrentDatabase',
  'getCurrentSchema',
  'getReplicationMode',
  'getMemorySql',
  'clearSqlMemory',
  'enableSqlMemory',
  'disableSqlMemory',
])

export const TRANSACTION_METHODS: Readonly<Record<string, 'start' | 'commit' | 'rollback'>> = {
  startTransaction: 'start',
  commitTransaction: 'commit',
  rollbackTransaction: 'rollback',
}

export type BuilderResult = { ok: true; ops: OperationBody[] } | { ok: false; reason: string }

type Handler = (args: Value[], dialect: Dialect) => OperationBody[]

/** Thrown inside handlers and turned into an unanalyzable result. */
class Unresolved extends Error {}

const fail = (reason: string): never => {
  throw new Unresolved(reason)
}

export const BUILDER_METHODS: Readonly<Record<string, Handler>> = {
  createTable: ([table]) => [{ kind: 'create_table', table: tableArg(table, 'table') }],
  dropTable: ([table]) => [{ kind: 'drop_table', table: tableArg(table, 'table') }],
  renameTable: ([table, to]) => [
    { kind: 'rename_table', table: tableArg(table, 'table'), to: tableArg(to, 'new name').name },
  ],
  addColumn: ([table, column]) => [addColumn(tableArg(table, 'table'), column)],
  addColumns: ([table, columns]) => {
    const t = tableArg(table, 'table')
    return list(columns, 'columns').map((c) => addColumn(t, c))
  },
  dropColumn: ([table, column]) => [
    { kind: 'drop_column', table: tableArg(table, 'table'), column: nameOf(column, 'column') },
  ],
  dropColumns: ([table, columns]) => {
    const t = tableArg(table, 'table')
    return list(columns, 'columns').map((c) => ({
      kind: 'drop_column',
      table: t,
      column: nameOf(c, 'column'),
    }))
  },
  renameColumn: ([table, from, to]) => [
    {
      kind: 'rename_column',
      table: tableArg(table, 'table'),
      column: nameOf(from, 'old column'),
      to: nameOf(to, 'new column'),
    },
  ],
  changeColumn: ([table, from, to], dialect) =>
    changeColumn(tableArg(table, 'table'), from, to, dialect),
  changeColumns: ([table, changes], dialect) => {
    const t = tableArg(table, 'table')
    return list(changes, 'changes').flatMap((c) => {
      const o = object(c, 'change')
      return changeColumn(t, o.props.get('oldColumn'), o.props.get('newColumn'), dialect)
    })
  },
  createIndex: ([table, index]) => [createIndex(tableArg(table, 'table'), index)],
  createIndices: ([table, indices]) => {
    const t = tableArg(table, 'table')
    return list(indices, 'indices').map((i) => createIndex(t, i))
  },
  dropIndex: ([table, index]) => {
    tableArg(table, 'table')
    if (index?.kind === 'string')
      return [{ kind: 'drop_index', name: index.value, concurrently: false }]
    const o = object(index, 'index')
    return [
      {
        kind: 'drop_index',
        name: str(o.props.get('name'), 'index name') ?? fail('Could not resolve the index name'),
        concurrently: bool(o, 'isConcurrent'),
      },
    ]
  },
  createForeignKey: ([table, fk]) => [foreignKey(tableArg(table, 'table'), fk)],
  createForeignKeys: ([table, fks]) => {
    const t = tableArg(table, 'table')
    return list(fks, 'foreign keys').map((fk) => foreignKey(t, fk))
  },
  dropForeignKey: ([table, fk]) => [dropConstraint(tableArg(table, 'table'), fk, 'foreign_key')],
  dropForeignKeys: ([table, fks]) => {
    const t = tableArg(table, 'table')
    return list(fks, 'foreign keys').map((fk) => dropConstraint(t, fk, 'foreign_key'))
  },
  createPrimaryKey: ([table, , name]) => [
    withName(
      {
        kind: 'add_constraint',
        table: tableArg(table, 'table'),
        type: 'primary_key',
        notValid: false,
      },
      optionalName(name),
    ),
  ],
  dropPrimaryKey: ([table, name]) => [
    withName(
      { kind: 'drop_constraint', table: tableArg(table, 'table'), type: 'primary_key' },
      optionalName(name),
    ),
  ],
  createUniqueConstraint: ([table, unique]) => [
    constraint(tableArg(table, 'table'), unique, 'unique'),
  ],
  createUniqueConstraints: ([table, uniques]) => {
    const t = tableArg(table, 'table')
    return list(uniques, 'unique constraints').map((u) => constraint(t, u, 'unique'))
  },
  dropUniqueConstraint: ([table, unique]) => [
    dropConstraint(tableArg(table, 'table'), unique, 'unique'),
  ],
  dropUniqueConstraints: ([table, uniques]) => {
    const t = tableArg(table, 'table')
    return list(uniques, 'unique constraints').map((u) => dropConstraint(t, u, 'unique'))
  },
  createCheckConstraint: ([table, check]) => [constraint(tableArg(table, 'table'), check, 'check')],
  createCheckConstraints: ([table, checks]) => {
    const t = tableArg(table, 'table')
    return list(checks, 'check constraints').map((c) => constraint(t, c, 'check'))
  },
  dropCheckConstraint: ([table, check]) => [
    dropConstraint(tableArg(table, 'table'), check, 'check'),
  ],
  dropCheckConstraints: ([table, checks]) => {
    const t = tableArg(table, 'table')
    return list(checks, 'check constraints').map((c) => dropConstraint(t, c, 'check'))
  },
  clearTable: ([table]) => [{ kind: 'truncate', tables: [tableArg(table, 'table')] }],
}

/** Maps a QueryRunner builder call to IR operations. */
export function mapBuilderCall(method: string, args: Value[], dialect: Dialect): BuilderResult {
  const handler = BUILDER_METHODS[method]
  if (handler === undefined)
    return { ok: false, reason: `Unsupported QueryRunner method "${method}"` }
  try {
    return { ok: true, ops: handler(args, dialect) }
  } catch (error) {
    if (error instanceof Unresolved) return { ok: false, reason: `${method}(): ${error.message}` }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Value helpers

type ObjectValue = Extract<Value, { kind: 'object' }>

function object(v: Value | undefined, what: string): ObjectValue {
  if (v?.kind === 'object' && !v.partial) return v
  if (v?.kind === 'object')
    return fail(`Could not resolve every option of the ${what} (spread or computed keys)`)
  return fail(`Could not resolve the ${what}${v?.kind === 'unknown' ? ` (${v.reason})` : ''}`)
}

function list(v: Value | undefined, what: string): Value[] {
  if (v?.kind === 'array') return v.items
  return fail(`Could not resolve the ${what} list`)
}

/** A string option. Returns undefined when absent, fails when present but not resolvable. */
function str(v: Value | undefined, what: string): string | undefined {
  if (v === undefined || v.kind === 'undefined') return undefined
  if (v.kind === 'string') return v.value
  return fail(`Could not resolve the ${what}`)
}

/** A boolean option, with TypeORM's default of false. */
function bool(o: ObjectValue, key: string): boolean {
  const v = o.props.get(key)
  if (v === undefined || v.kind === 'undefined') return false
  if (v.kind === 'boolean') return v.value
  return fail(`Could not resolve option "${key}"`)
}

function nameOf(v: Value | undefined, what: string): string {
  if (v?.kind === 'string') return v.value
  const name = str(object(v, what).props.get('name'), `${what} name`)
  return name ?? fail(`The ${what} has no name`)
}

function optionalName(v: Value | undefined): string | undefined {
  return str(v, 'constraint name')
}

function withName<T extends object>(op: T, name: string | undefined): T & { name?: string } {
  return name === undefined ? op : { ...op, name }
}

export function parseTableName(qualified: string): TableRef {
  const parts = qualified.split('.').map((p) => p.replace(/^"(.*)"$/, '$1'))
  if (parts.length === 2 && parts[0] !== undefined && parts[1] !== undefined) {
    return { schema: parts[0], name: parts[1] }
  }
  return { name: qualified.replace(/^"(.*)"$/, '$1') }
}

function tableArg(v: Value | undefined, what: string): TableRef {
  if (v?.kind === 'string') return parseTableName(v.value)
  if (v?.kind === 'table') return v.table
  if (v?.kind === 'object') {
    const name = str(v.props.get('name'), `${what} name`) ?? fail(`The ${what} has no name`)
    const schema = str(v.props.get('schema'), `${what} schema`)
    const ref = parseTableName(name)
    return schema === undefined ? ref : { schema, name: ref.name }
  }
  return fail(`Could not resolve the ${what}${v?.kind === 'unknown' ? ` (${v.reason})` : ''}`)
}

// ---------------------------------------------------------------------------
// Columns

/** Reads a column option with the default TypeORM's TableColumn constructor applies. */
function columnOption(o: ObjectValue, key: string): Value {
  const v = o.props.get(key)
  if (v !== undefined && v.kind !== 'undefined') return v
  if (o.ctor !== 'TableColumn') return { kind: 'undefined' }
  if (key === 'type' || key === 'length') return { kind: 'string', value: '' }
  if (['isNullable', 'isGenerated', 'isPrimary', 'isUnique', 'isArray'].includes(key)) {
    return { kind: 'boolean', value: false }
  }
  return { kind: 'undefined' }
}

function addColumn(table: TableRef, column: Value | undefined): OperationBody {
  const o = object(column, 'column')
  const name = str(o.props.get('name'), 'column name') ?? fail('The column has no name')
  const op: Extract<OperationBody, { kind: 'add_column' }> = {
    kind: 'add_column',
    table,
    column: name,
    notNull: !bool(o, 'isNullable'),
  }

  const type = o.props.get('type')
  if (type?.kind === 'string') {
    const length = o.props.get('length')
    const size =
      length?.kind === 'string' || length?.kind === 'number' ? `(${String(length.value)})` : ''
    op.type = `${type.value}${size === '()' ? '' : size}${bool(o, 'isArray') ? '[]' : ''}`
  }

  const dflt = o.props.get('default')
  if (dflt?.kind === 'string' || dflt?.kind === 'number' || dflt?.kind === 'boolean') {
    const expr = String(dflt.value)
    op.default = { expr, volatile: isVolatileDefault(expr) }
  } else if (dflt !== undefined && dflt.kind !== 'undefined' && dflt.kind !== 'null') {
    fail('Could not resolve option "default"')
  }

  if (bool(o, 'isGenerated')) {
    const strategy = str(o.props.get('generationStrategy'), 'generation strategy') ?? 'increment'
    if (strategy === 'increment') op.default = { expr: 'nextval (serial)', volatile: true }
    else if (strategy === 'uuid') op.default = { expr: 'uuid_generate_v4()', volatile: true }
    else if (strategy === 'identity') op.generated = 'identity'
  }
  if (str(o.props.get('generatedType'), 'generated type') === 'STORED') op.generated = 'stored'
  return op
}

const same = (a: Value, b: Value): boolean | 'unknown' => {
  if (a.kind === 'unknown' || b.kind === 'unknown') return 'unknown'
  if (a.kind !== b.kind) return false
  if ('value' in a && 'value' in b) return a.value === b.value
  return a.kind === 'undefined' || a.kind === 'null'
}

const truthy = (v: Value): boolean =>
  (v.kind === 'string' && v.value !== '') ||
  (v.kind === 'boolean' && v.value) ||
  (v.kind === 'number' && v.value !== 0)

/**
 * TypeORM's own conditions for dropping and re-adding a column in changeColumn,
 * from PostgresQueryRunner.changeColumn and MysqlQueryRunner.changeColumn.
 */
function recreates(from: ObjectValue, to: ObjectValue, dialect: Dialect): 'yes' | 'no' | 'unknown' {
  const f = (key: string) => columnOption(from, key)
  const t = (key: string) => columnOption(to, key)
  const differs = (key: string) => {
    const s = same(f(key), t(key))
    return s === 'unknown' ? 'unknown' : !s
  }
  const val = (v: Value) => ('value' in v ? v.value : undefined)

  const checks: (() => boolean | 'unknown')[] =
    dialect === 'postgres'
      ? [
          () => differs('type'),
          () => differs('length'),
          () => differs('isArray'),
          () => !truthy(f('generatedType')) && val(t('generatedType')) === 'STORED',
          () => {
            const d = differs('asExpression')
            return d === 'unknown' ? d : d && val(t('generatedType')) === 'STORED'
          },
        ]
      : [
          () => {
            const d = differs('isGenerated')
            return d === 'unknown' ? d : d && val(t('generationStrategy')) !== 'uuid'
          },
          () => differs('type'),
          () => differs('length'),
          () =>
            truthy(f('generatedType')) &&
            truthy(t('generatedType')) &&
            val(f('generatedType')) !== val(t('generatedType')),
          () => !truthy(f('generatedType')) && val(t('generatedType')) === 'VIRTUAL',
          () => val(f('generatedType')) === 'VIRTUAL' && !truthy(t('generatedType')),
        ]

  let unknown = false
  for (const check of checks) {
    const result = check()
    if (result === true) return 'yes'
    if (result === 'unknown') unknown = true
  }
  return unknown ? 'unknown' : 'no'
}

function changeColumn(
  table: TableRef,
  from: Value | undefined,
  to: Value | undefined,
  dialect: Dialect,
): OperationBody[] {
  const next = object(to, 'new column')
  const nextName =
    str(next.props.get('name'), 'new column name') ?? fail('The new column has no name')

  if (from?.kind === 'string') {
    // TypeORM looks the old column up in the database, so it cannot be compared here.
    return [{ kind: 'typeorm.change_column', table, column: from.value, recreates: 'unknown' }]
  }
  const prev = object(from, 'old column')
  const prevName =
    str(prev.props.get('name'), 'old column name') ?? fail('The old column has no name')
  const result = recreates(prev, next, dialect)
  const ops: OperationBody[] = [
    { kind: 'typeorm.change_column', table, column: prevName, recreates: result },
  ]
  if (result !== 'no') return ops

  // The column is altered in place. Report the parts that core rules check.
  if (prevName !== nextName)
    ops.push({ kind: 'rename_column', table, column: prevName, to: nextName })
  if (bool(prev, 'isNullable') && !bool(next, 'isNullable')) {
    ops.push({ kind: 'set_not_null', table, column: nextName })
  }
  if (!bool(prev, 'isUnique') && bool(next, 'isUnique')) {
    ops.push({ kind: 'add_constraint', table, type: 'unique', notValid: false })
  }
  return ops
}

// ---------------------------------------------------------------------------
// Indexes and constraints

function createIndex(table: TableRef, index: Value | undefined): OperationBody {
  const o = object(index, 'index')
  return withName(
    {
      kind: 'create_index',
      table,
      unique: bool(o, 'isUnique'),
      concurrently: bool(o, 'isConcurrent'),
    },
    str(o.props.get('name'), 'index name'),
  )
}

function foreignKey(table: TableRef, fk: Value | undefined): OperationBody {
  const o = object(fk, 'foreign key')
  const referenced = str(o.props.get('referencedTableName'), 'referenced table')
  const schema = str(o.props.get('referencedSchema'), 'referenced schema')
  const op: Extract<OperationBody, { kind: 'add_constraint' }> = withName(
    { kind: 'add_constraint', table, type: 'foreign_key', notValid: false },
    str(o.props.get('name'), 'foreign key name'),
  )
  if (referenced !== undefined) {
    const ref = parseTableName(referenced)
    op.references = schema === undefined ? ref : { schema, name: ref.name }
  }
  return op
}

function constraint(
  table: TableRef,
  v: Value | undefined,
  type: 'unique' | 'check',
): OperationBody {
  const o = object(v, type === 'unique' ? 'unique constraint' : 'check constraint')
  return withName(
    { kind: 'add_constraint', table, type, notValid: false },
    str(o.props.get('name'), 'constraint name'),
  )
}

function dropConstraint(
  table: TableRef,
  v: Value | undefined,
  type: ConstraintType,
): OperationBody {
  // The name is optional in the IR: even when it cannot be resolved (for example
  // `table.foreignKeys.find(...)`), a constraint of this type is dropped from a known table.
  let name: string | undefined
  if (v?.kind === 'string') name = v.value
  else if (v?.kind === 'object') {
    const n = v.props.get('name')
    if (n?.kind === 'string') name = n.value
  }
  return withName({ kind: 'drop_constraint', table, type }, name)
}
