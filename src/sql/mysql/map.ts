import type { ConstraintType, OperationBody, TableRef } from '../../ir/types.js'
import { normalizeMysqlType } from '../type-names.js'
import { VOLATILE_FUNCTIONS } from '../volatility.js'

/**
 * The parts of node-sql-parser's MySQL AST this mapper reads. The library's own types are
 * loose, so fields are checked at runtime.
 */
export interface MysqlAst {
  type?: string
  keyword?: string
  [key: string]: unknown
}

type Obj = Record<string, unknown>

const MYSQL_VOLATILE = new Set([...VOLATILE_FUNCTIONS, 'uuid', 'uuid_short', 'rand', 'sysdate'])

/** Statements that are understood and cannot cause any hazard the rules check. */
const NO_OP_TYPES = new Set([
  'select',
  'insert',
  'replace',
  'update',
  'delete',
  'show',
  'use',
  'desc',
])
const NO_OP_OBJECTS = new Set([
  'view',
  'trigger',
  'procedure',
  'function',
  'event',
  'database',
  'schema',
])

const unanalyzable = (reason: string): OperationBody => ({ kind: 'unanalyzable', reason })

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

/** Maps one parsed MySQL statement to IR operations. */
export function mapStatement(ast: MysqlAst): OperationBody[] {
  const type = ast.type ?? ''
  const keyword = (ast.keyword ?? '').toLowerCase()

  switch (type) {
    case 'alter': {
      const t = tableRef(first(ast.table))
      return list(ast.expr).flatMap((e) => mapAlter(e, t))
    }
    case 'create':
      if (keyword === 'table') return [{ kind: 'create_table', table: tableRef(first(ast.table)) }]
      if (keyword === 'index') {
        const op: OperationBody = {
          kind: 'create_index',
          table: tableRef(ast.table),
          unique: ast.index_type === 'unique',
          concurrently: false,
        }
        const name = str(ast.index)
        return [name === undefined ? op : { ...op, name }]
      }
      break
    case 'drop':
      if (keyword === 'table') {
        return list(ast.name).map((n) => ({ kind: 'drop_table', table: tableRef(n) }))
      }
      if (keyword === 'index') {
        const name = isObj(ast.name) ? str(ast.name.column) : undefined
        return [
          name === undefined
            ? { kind: 'drop_index', concurrently: false }
            : { kind: 'drop_index', name, concurrently: false },
        ]
      }
      break
    case 'rename':
      return list(ast.table).flatMap((pair) => {
        if (!Array.isArray(pair)) return []
        const [from, to] = pair as unknown[]
        return [{ kind: 'rename_table', table: tableRef(from), to: tableRef(to).name }]
      })
    case 'truncate':
      return [{ kind: 'truncate', tables: list(ast.name).map(tableRef) }]
    case 'set':
      return list(ast.expr).flatMap((e) => {
        const left = isObj(e.left) ? str(e.left.name) : undefined
        if (left === undefined) return []
        return [{ kind: 'set_setting', name: left, value: render(e.right) }]
      })
    default:
      break
  }
  if (NO_OP_TYPES.has(type)) return []
  if ((type === 'create' || type === 'drop') && NO_OP_OBJECTS.has(keyword)) return []
  return [
    unanalyzable(
      `This kind of statement (${[type, keyword].filter(Boolean).join(' ')}) is not analyzed`,
    ),
  ]
}

function mapAlter(e: Obj, t: TableRef): OperationBody[] {
  const action = str(e.action)
  const resource = str(e.resource)
  if (resource === 'algorithm' || resource === 'lock') return []

  if (resource === 'column') {
    const column = columnName(e.column)
    switch (action) {
      case 'add':
        return [addColumn(e, t, column)]
      case 'drop':
        return [{ kind: 'drop_column', table: t, column }]
      case 'modify':
        return [
          { kind: 'alter_column_type', table: t, column, to: typeOf(e.definition), using: false },
        ]
      case 'change': {
        const old = columnName(e.old_column)
        const ops: OperationBody[] = [
          {
            kind: 'alter_column_type',
            table: t,
            column: old,
            to: typeOf(e.definition),
            using: false,
          },
        ]
        if (old !== column) ops.push({ kind: 'rename_column', table: t, column: old, to: column })
        return ops
      }
      case 'rename':
        return [{ kind: 'rename_column', table: t, column: columnName(e.old_column), to: column }]
      default:
        break
    }
  }
  if (resource === 'table' && action === 'rename') {
    return [{ kind: 'rename_table', table: t, to: str(e.table) ?? '' }]
  }
  if (action === 'add' && resource === 'index') {
    return [indexOp(t, str(e.index), false)]
  }
  if (action === 'add' && resource === 'constraint' && isObj(e.create_definitions)) {
    return [addConstraint(e.create_definitions, t)]
  }
  if (action === 'drop' && (resource === 'index' || resource === 'key')) {
    const kind = str(e.keyword)?.toLowerCase()
    const name = str(e.index) ?? str(e.key)
    if (kind === 'foreign key') return [dropConstraint(t, 'foreign_key', name)]
    if (kind === 'primary key') return [dropConstraint(t, 'primary_key', undefined)]
    return [
      name === undefined
        ? { kind: 'drop_index', concurrently: false }
        : { kind: 'drop_index', name, concurrently: false },
    ]
  }
  return [
    unanalyzable(
      `This ALTER TABLE action (${[action, resource].filter(Boolean).join(' ')}) is not analyzed`,
    ),
  ]
}

function addColumn(e: Obj, t: TableRef, column: string): OperationBody {
  const op: Extract<OperationBody, { kind: 'add_column' }> = {
    kind: 'add_column',
    table: t,
    column,
    type: typeOf(e.definition),
    notNull: isObj(e.nullable) && e.nullable.type === 'not null',
  }
  if (isObj(e.default_val)) {
    const value = e.default_val.value
    op.default = { expr: render(value), volatile: callsVolatile(value) }
  }
  return op
}

function addConstraint(def: Obj, t: TableRef): OperationBody {
  const kind = (str(def.constraint_type) ?? '').toLowerCase()
  const name = str(def.constraint) ?? undefined
  if (
    kind === 'index' ||
    kind === 'key' ||
    kind === 'unique index' ||
    kind === 'fulltext' ||
    kind === 'spatial'
  ) {
    return indexOp(t, str(def.index), kind === 'unique index')
  }
  const types: Readonly<Record<string, ConstraintType>> = {
    'foreign key': 'foreign_key',
    'primary key': 'primary_key',
    unique: 'unique',
    'unique key': 'unique',
    check: 'check',
  }
  const type = types[kind]
  if (type === undefined) return unanalyzable(`This kind of constraint (${kind}) is not analyzed`)
  const op: Extract<OperationBody, { kind: 'add_constraint' }> = {
    kind: 'add_constraint',
    table: t,
    ...(name === undefined ? {} : { name }),
    type,
    notValid: false,
  }
  if (type === 'foreign_key' && isObj(def.reference_definition)) {
    op.references = tableRef(first(def.reference_definition.table))
  }
  return op
}

function indexOp(t: TableRef, name: string | undefined, unique: boolean): OperationBody {
  const op: OperationBody = { kind: 'create_index', table: t, unique, concurrently: false }
  return name === undefined ? op : { ...op, name }
}

function dropConstraint(
  t: TableRef,
  type: ConstraintType,
  name: string | undefined,
): OperationBody {
  return name === undefined || name === ''
    ? { kind: 'drop_constraint', table: t, type }
    : { kind: 'drop_constraint', table: t, name, type }
}

// ---------------------------------------------------------------------------
// Helpers

function list(v: unknown): Obj[] {
  return Array.isArray(v) ? (v as unknown[]).filter(isObj) : isObj(v) ? [v] : []
}

function first(v: unknown): unknown {
  return Array.isArray(v) ? (v as unknown[])[0] : v
}

function tableRef(v: unknown): TableRef {
  if (!isObj(v)) return { name: '' }
  const name = str(v.table) ?? ''
  const db = str(v.db)
  return db === undefined ? { name } : { schema: db, name }
}

function columnName(v: unknown): string {
  if (!isObj(v)) return ''
  const column = v.column
  if (typeof column === 'string') return column
  // Newer node-sql-parser versions wrap names: { expr: { value } }
  if (isObj(column) && isObj(column.expr)) return str(column.expr.value) ?? ''
  return ''
}

/** Renders a column type: `varchar(255)`, `decimal(10,2) unsigned`, `enum('a','b')`. */
function typeOf(def: unknown): string {
  if (!isObj(def)) return ''
  let type = str(def.dataType) ?? ''
  if (isObj(def.expr)) type += `(${list(def.expr.value).map(render).join(',')})`
  else if (typeof def.length === 'number') {
    type +=
      typeof def.scale === 'number'
        ? `(${String(def.length)},${String(def.scale)})`
        : `(${String(def.length)})`
  }
  const suffix = Array.isArray(def.suffix)
    ? (def.suffix as unknown[]).filter((s) => typeof s === 'string')
    : []
  if (suffix.length > 0) type += ` ${suffix.join(' ')}`
  return normalizeMysqlType(type)
}

/** Renders a default value for messages. */
function render(v: unknown): string {
  if (!isObj(v)) return ''
  switch (v.type) {
    case 'number':
      return String(v.value)
    case 'single_quote_string':
      return `'${String(v.value).replace(/'/g, "''")}'`
    case 'double_quote_string':
      return `"${String(v.value)}"`
    case 'bool':
      return String(v.value).toUpperCase()
    case 'null':
      return 'NULL'
    case 'function': {
      const args = isObj(v.args) ? list(v.args.value).map(render).join(', ') : ''
      return `${functionName(v)}(${args})`
    }
    default:
      return typeof v.value === 'string' || typeof v.value === 'number'
        ? String(v.value)
        : 'expression'
  }
}

function functionName(v: Obj): string {
  const name = v.name
  if (typeof name === 'string') return name
  if (isObj(name))
    return list(name.name)
      .map((p) => String(p.value))
      .join('.')
  return ''
}

function callsVolatile(v: unknown): boolean {
  if (Array.isArray(v)) return (v as unknown[]).some(callsVolatile)
  if (!isObj(v)) return false
  if (v.type === 'function' && MYSQL_VOLATILE.has(functionName(v).toLowerCase())) return true
  return Object.values(v).some(callsVolatile)
}
