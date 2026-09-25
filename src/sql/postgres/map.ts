import type { AlterTableCmd, ColumnDef, Constraint, Node, RangeVar, TypeName } from 'libpg-query'
import type { ConstraintType, OperationBody, TableRef } from '../../ir/types.js'
import type { Utf8Offsets } from '../offsets.js'
import { canonicalPostgresType, SERIAL_TYPES } from '../type-names.js'
import { VOLATILE_FUNCTIONS } from '../volatility.js'

export interface MapContext {
  sql: string
  offsets: Utf8Offsets
  /** UTF-16 index where the current statement ends. */
  end: number
}

/** Statements that are understood and cannot cause any hazard the rules check. */
const NO_OP_STATEMENTS = new Set([
  'SelectStmt',
  'InsertStmt',
  'UpdateStmt',
  'DeleteStmt',
  'MergeStmt',
  'CommentStmt',
  'GrantStmt',
  'GrantRoleStmt',
  'AlterDefaultPrivilegesStmt',
  'CreateExtensionStmt',
  'AlterExtensionStmt',
  'CreateSeqStmt',
  'AlterSeqStmt',
  'ViewStmt',
  'CreateTrigStmt',
  'CreateSchemaStmt',
  'CreateDomainStmt',
  'CompositeTypeStmt',
  'DefineStmt',
  'CreateCastStmt',
  'AlterOwnerStmt',
  'VariableShowStmt',
  'NotifyStmt',
  'ListenStmt',
  'UnlistenStmt',
])

/** DROP of objects that no rule checks. */
const NO_OP_DROPS = new Set([
  'OBJECT_VIEW',
  'OBJECT_MATVIEW',
  'OBJECT_SEQUENCE',
  'OBJECT_FUNCTION',
  'OBJECT_PROCEDURE',
  'OBJECT_ROUTINE',
  'OBJECT_TRIGGER',
  'OBJECT_EXTENSION',
  'OBJECT_SCHEMA',
  'OBJECT_POLICY',
  'OBJECT_RULE',
  'OBJECT_DOMAIN',
  'OBJECT_AGGREGATE',
  'OBJECT_OPERATOR',
  'OBJECT_CAST',
])

/** ALTER TABLE actions that take a brief lock without scanning or rewriting the table. */
const NO_OP_ALTER_TABLE = new Set([
  'AT_ColumnDefault',
  'AT_DropNotNull',
  'AT_SetStatistics',
  'AT_SetStorage',
  'AT_SetCompression',
  'AT_ChangeOwner',
  'AT_EnableTrig',
  'AT_DisableTrig',
  'AT_EnableAlwaysTrig',
  'AT_EnableReplicaTrig',
  'AT_EnableTrigAll',
  'AT_DisableTrigAll',
  'AT_EnableTrigUser',
  'AT_DisableTrigUser',
  'AT_ReplicaIdentity',
  'AT_EnableRowSecurity',
  'AT_DisableRowSecurity',
  'AT_ForceRowSecurity',
  'AT_NoForceRowSecurity',
  'AT_DropIdentity',
  'AT_SetIdentity',
  'AT_AlterConstraint',
  'AT_SetRelOptions',
  'AT_ResetRelOptions',
])

const LOCK_MODES = [
  '',
  'ACCESS SHARE',
  'ROW SHARE',
  'ROW EXCLUSIVE',
  'SHARE UPDATE EXCLUSIVE',
  'SHARE',
  'SHARE ROW EXCLUSIVE',
  'EXCLUSIVE',
  'ACCESS EXCLUSIVE',
]

const DO_REASON = 'DO blocks are not analyzed; use --execute or suppress with a reason'
const FUNCTION_REASON = 'Function bodies are not analyzed; suppress with a reason'

const unanalyzable = (reason: string): OperationBody => ({ kind: 'unanalyzable', reason })

/** Maps one parsed PostgreSQL statement to IR operations. */
export function mapStatement(node: Node, ctx: MapContext): OperationBody[] {
  if ('CreateStmt' in node)
    return [{ kind: 'create_table', table: table(node.CreateStmt.relation) }]
  if ('CreateTableAsStmt' in node) {
    const { into, objtype } = node.CreateTableAsStmt
    return objtype === 'OBJECT_MATVIEW' ? [] : [{ kind: 'create_table', table: table(into?.rel) }]
  }
  if ('DropStmt' in node) return mapDrop(node.DropStmt)
  if ('AlterTableStmt' in node) {
    const { relation, cmds, objtype } = node.AlterTableStmt
    if (objtype !== undefined && objtype !== 'OBJECT_TABLE') return []
    const t = table(relation)
    return (cmds ?? []).flatMap((c) =>
      'AlterTableCmd' in c ? mapAlterTableCmd(c.AlterTableCmd, t, ctx) : [],
    )
  }
  if ('RenameStmt' in node) {
    const r = node.RenameStmt
    const to = r.newname ?? ''
    switch (r.renameType) {
      case 'OBJECT_TABLE':
        return [{ kind: 'rename_table', table: table(r.relation), to }]
      case 'OBJECT_COLUMN':
        return [{ kind: 'rename_column', table: table(r.relation), column: r.subname ?? '', to }]
      case 'OBJECT_TYPE':
        return [{ kind: 'enum_rename', from: qualified(listNames(r.object)), to }]
      default:
        return []
    }
  }
  if ('IndexStmt' in node) {
    const i = node.IndexStmt
    const op: OperationBody = {
      kind: 'create_index',
      table: table(i.relation),
      unique: i.unique === true,
      concurrently: i.concurrent === true,
    }
    return [i.idxname === undefined ? op : { ...op, name: i.idxname }]
  }
  if ('TruncateStmt' in node) {
    const tables = (node.TruncateStmt.relations ?? []).flatMap((r) =>
      'RangeVar' in r ? [table(r.RangeVar)] : [],
    )
    return [{ kind: 'truncate', tables }]
  }
  if ('CreateEnumStmt' in node) {
    return [{ kind: 'enum_create', name: qualified(names(node.CreateEnumStmt.typeName)) }]
  }
  if ('AlterEnumStmt' in node) {
    const e = node.AlterEnumStmt
    if (e.oldVal !== undefined || e.newVal === undefined) return [] // RENAME VALUE
    return [{ kind: 'enum_add_value', name: qualified(names(e.typeName)), value: e.newVal }]
  }
  if ('VariableSetStmt' in node) {
    const v = node.VariableSetStmt
    if (v.kind !== 'VAR_SET_VALUE' || v.name === undefined) return []
    return [{ kind: 'set_setting', name: v.name, value: (v.args ?? []).map(constant).join(', ') }]
  }
  if ('VacuumStmt' in node) {
    const v = node.VacuumStmt
    const full = (v.options ?? []).some((o) => 'DefElem' in o && o.DefElem.defname === 'full')
    return v.is_vacuumcmd === true && full
      ? [{ kind: 'maintenance', command: 'vacuum_full', concurrently: false }]
      : []
  }
  if ('ClusterStmt' in node)
    return [{ kind: 'maintenance', command: 'cluster', concurrently: false }]
  if ('ReindexStmt' in node) {
    const concurrently = (node.ReindexStmt.params ?? []).some(
      (p) => 'DefElem' in p && p.DefElem.defname === 'concurrently',
    )
    return [{ kind: 'maintenance', command: 'reindex', concurrently }]
  }
  if ('TransactionStmt' in node) {
    switch (node.TransactionStmt.kind) {
      case 'TRANS_STMT_BEGIN':
      case 'TRANS_STMT_START':
        return [{ kind: 'transaction_control', action: 'start' }]
      case 'TRANS_STMT_COMMIT':
        return [{ kind: 'transaction_control', action: 'commit' }]
      case 'TRANS_STMT_ROLLBACK':
        return [{ kind: 'transaction_control', action: 'rollback' }]
      default:
        return [] // savepoints
    }
  }
  if ('LockStmt' in node) {
    const l = node.LockStmt
    const tables = (l.relations ?? []).flatMap((r) => ('RangeVar' in r ? [table(r.RangeVar)] : []))
    return [{ kind: 'lock_table', tables, mode: LOCK_MODES[l.mode ?? 8] ?? 'ACCESS EXCLUSIVE' }]
  }
  if ('DoStmt' in node) return [unanalyzable(DO_REASON)]
  if ('CreateFunctionStmt' in node) return [unanalyzable(FUNCTION_REASON)]

  const [type] = Object.keys(node)
  if (type !== undefined && NO_OP_STATEMENTS.has(type)) return []
  return [unanalyzable(`This kind of statement (${type ?? 'unknown'}) is not analyzed`)]
}

function mapDrop(drop: import('libpg-query').DropStmt): OperationBody[] {
  const objects = drop.objects ?? []
  switch (drop.removeType) {
    case 'OBJECT_TABLE':
      return objects.map((o) => ({ kind: 'drop_table', table: tableFromNames(listNames(o)) }))
    case 'OBJECT_INDEX':
      return objects.map((o) => ({
        kind: 'drop_index',
        name: qualified(listNames(o)),
        concurrently: drop.concurrent === true,
      }))
    case 'OBJECT_TYPE':
      return objects.map((o) => ({
        kind: 'enum_drop',
        name: qualified('TypeName' in o ? names(o.TypeName) : listNames(o)),
      }))
    default:
      if (drop.removeType !== undefined && NO_OP_DROPS.has(drop.removeType)) return []
      return [unanalyzable(`This kind of DROP (${drop.removeType ?? 'unknown'}) is not analyzed`)]
  }
}

function mapAlterTableCmd(cmd: AlterTableCmd, t: TableRef, ctx: MapContext): OperationBody[] {
  const subtype = cmd.subtype ?? 'unknown'
  const def = cmd.def
  switch (subtype) {
    case 'AT_AddColumn':
      return def !== undefined && 'ColumnDef' in def ? addColumn(def.ColumnDef, t, ctx) : []
    case 'AT_DropColumn':
      return [{ kind: 'drop_column', table: t, column: cmd.name ?? '' }]
    case 'AT_AlterColumnType': {
      const col = def !== undefined && 'ColumnDef' in def ? def.ColumnDef : undefined
      const op: Extract<OperationBody, { kind: 'alter_column_type' }> = {
        kind: 'alter_column_type',
        table: t,
        column: cmd.name ?? '',
        to: col?.typeName ? typeString(col.typeName) : '',
        using: col?.raw_default !== undefined,
      }
      const mods = col?.typeName ? typmods(col.typeName) : []
      return [mods.length > 0 && isBuiltin(col?.typeName) ? { ...op, toTypmods: mods } : op]
    }
    case 'AT_SetNotNull':
      return [{ kind: 'set_not_null', table: t, column: cmd.name ?? '' }]
    case 'AT_AddConstraint':
      return def !== undefined && 'Constraint' in def ? [addConstraint(def.Constraint, t)] : []
    case 'AT_ValidateConstraint':
      return [{ kind: 'validate_constraint', table: t, name: cmd.name ?? '' }]
    case 'AT_DropConstraint':
      return [
        cmd.name === undefined
          ? { kind: 'drop_constraint', table: t }
          : { kind: 'drop_constraint', table: t, name: cmd.name },
      ]
    default:
      if (NO_OP_ALTER_TABLE.has(subtype)) return []
      return [unanalyzable(`This ALTER TABLE action (${subtype}) is not analyzed`)]
  }
}

function addColumn(col: ColumnDef, t: TableRef, ctx: MapContext): OperationBody[] {
  const typeName = col.typeName
  const baseType = typeName ? lastName(typeName) : undefined
  const serial = baseType !== undefined && SERIAL_TYPES.has(baseType.toLowerCase())
  const constraints = (col.constraints ?? []).flatMap((c) =>
    'Constraint' in c ? [c.Constraint] : [],
  )

  const op: Extract<OperationBody, { kind: 'add_column' }> = {
    kind: 'add_column',
    table: t,
    column: col.colname ?? '',
    notNull: serial,
  }
  if (typeName) op.type = typeString(typeName)
  if (serial) op.default = { expr: 'nextval (serial)', volatile: true }

  const extra: OperationBody[] = []
  constraints.forEach((c, i) => {
    switch (c.contype) {
      case 'CONSTR_NOTNULL':
      case 'CONSTR_PRIMARY':
        op.notNull = true
        if (c.contype === 'CONSTR_PRIMARY') extra.push(addConstraint(c, t))
        break
      case 'CONSTR_DEFAULT': {
        const next = constraints[i + 1]?.location
        const limit = next === undefined ? ctx.end : ctx.offsets.toIndex(next)
        op.default = {
          expr: defaultText(ctx.sql, ctx.offsets.toIndex(c.location ?? 0), limit),
          volatile: c.raw_expr !== undefined && callsVolatile(c.raw_expr),
        }
        break
      }
      case 'CONSTR_IDENTITY':
        op.generated = 'identity'
        op.notNull = true
        break
      case 'CONSTR_GENERATED':
        op.generated = 'stored'
        break
      case 'CONSTR_UNIQUE':
      case 'CONSTR_CHECK':
      case 'CONSTR_FOREIGN':
        extra.push(addConstraint(c, t))
        break
      default:
        break
    }
  })
  return [op, ...extra]
}

const CONSTRAINT_TYPES: Readonly<Record<string, ConstraintType>> = {
  CONSTR_FOREIGN: 'foreign_key',
  CONSTR_CHECK: 'check',
  CONSTR_UNIQUE: 'unique',
  CONSTR_PRIMARY: 'primary_key',
}

function addConstraint(c: Constraint, t: TableRef): OperationBody {
  const type = c.contype === undefined ? undefined : CONSTRAINT_TYPES[c.contype]
  if (type === undefined) {
    return unanalyzable(
      c.contype === 'CONSTR_EXCLUSION'
        ? 'EXCLUDE constraints are not analyzed'
        : `This kind of constraint (${c.contype ?? 'unknown'}) is not analyzed`,
    )
  }
  const op: Extract<OperationBody, { kind: 'add_constraint' }> = {
    kind: 'add_constraint',
    table: t,
    type,
    notValid: c.skip_validation === true,
  }
  if (c.conname !== undefined) op.name = c.conname
  if (c.indexname !== undefined) op.usingIndex = c.indexname
  if (c.pktable !== undefined) op.references = table(c.pktable)
  return Object.keys(op).length === 4 ? op : sortKeys(op)
}

/** Keeps a stable key order: kind, table, name, type, notValid, usingIndex, references. */
function sortKeys(op: Extract<OperationBody, { kind: 'add_constraint' }>): OperationBody {
  const { kind, table: t, name, type, notValid, usingIndex, references } = op
  return {
    kind,
    table: t,
    ...(name === undefined ? {} : { name }),
    type,
    notValid,
    ...(usingIndex === undefined ? {} : { usingIndex }),
    ...(references === undefined ? {} : { references }),
  }
}

// ---------------------------------------------------------------------------
// Names and types

function table(rv: RangeVar | undefined): TableRef {
  const name = rv?.relname ?? ''
  return rv?.schemaname === undefined ? { name } : { schema: rv.schemaname, name }
}

function tableFromNames(parts: string[]): TableRef {
  const name = parts.at(-1) ?? ''
  const schema = parts.at(-2)
  return schema === undefined ? { name } : { schema, name }
}

/** String values of a node list (`List`, or an array of `String` nodes). */
function listNames(node: Node | undefined): string[] {
  if (node === undefined) return []
  if ('List' in node) return names(node.List.items ?? [])
  if ('String' in node) return [node.String.sval ?? '']
  return []
}

function names(value: { names?: Node[] } | Node[] | undefined): string[] {
  const list = Array.isArray(value) ? value : (value?.names ?? [])
  return list.flatMap((n) => ('String' in n ? [n.String.sval ?? ''] : []))
}

const qualified = (parts: string[]) => parts.join('.')

function lastName(tn: TypeName): string | undefined {
  return names(tn).at(-1)
}

/** True for types from pg_catalog (or unqualified built-ins such as uuid). */
function isBuiltin(tn: TypeName | undefined): boolean {
  if (tn === undefined) return false
  const parts = names(tn)
  return parts.length === 1 || parts[0] === 'pg_catalog'
}

function typmods(tn: TypeName): number[] {
  return (tn.typmods ?? []).flatMap((m) => ('A_Const' in m ? [m.A_Const.ival?.ival ?? 0] : []))
}

/** Renders a type as written, with canonical names: `varchar(255)`, `numeric(10,2)[]`. */
function typeString(tn: TypeName): string {
  const parts = names(tn)
  const base = isBuiltin(tn) ? canonicalPostgresType(parts.at(-1) ?? '') : qualified(parts)
  const mods = typmods(tn)
  const dims = (tn.arrayBounds ?? []).length
  return `${base}${mods.length > 0 ? `(${mods.join(',')})` : ''}${'[]'.repeat(dims)}`
}

function constant(node: Node): string {
  if (!('A_Const' in node)) return ''
  const c = node.A_Const
  if (c.sval !== undefined) return c.sval.sval ?? ''
  if (c.fval !== undefined) return c.fval.fval ?? ''
  if (c.boolval !== undefined) return String(c.boolval.boolval ?? false)
  return String(c.ival?.ival ?? 0)
}

// ---------------------------------------------------------------------------
// Default expressions

/** True when the expression calls a volatile function anywhere inside it. */
function callsVolatile(expr: unknown): boolean {
  if (Array.isArray(expr)) return expr.some(callsVolatile)
  if (typeof expr !== 'object' || expr === null) return false
  const record = expr as Record<string, unknown>
  const call = record.FuncCall as { funcname?: Node[] } | undefined
  if (call !== undefined) {
    const name = names(call.funcname).at(-1)?.toLowerCase()
    if (name !== undefined && VOLATILE_FUNCTIONS.includes(name)) return true
  }
  return Object.values(record).some(callsVolatile)
}

/**
 * The default expression as written. `from` is the DEFAULT keyword; the expression ends at
 * the next constraint, or at a comma outside parentheses and quotes.
 */
export function defaultText(sql: string, from: number, limit: number): string {
  let i = from
  if (/^default\b/i.test(sql.slice(i, i + 8))) i += 7
  const start = i
  let depth = 0
  let quote: string | undefined
  for (; i < limit; i++) {
    const ch = sql.charAt(i)
    if (quote !== undefined) {
      if (ch === quote) quote = undefined
    } else if (ch === "'" || ch === '"') quote = ch
    else if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) break
  }
  return sql.slice(start, i).trim()
}
