import type { AlterTableCmd, ColumnDef, Constraint, Node, RangeVar, TypeName } from 'libpg-query'
import type { CheckExpr, ConstraintType, OperationBody, TableRef } from '../../ir/types.js'
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

const DO_REASON = 'DO blocks are not analyzed'
const FUNCTION_REASON = 'Function bodies are not analyzed'

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
  if ('InsertStmt' in node) {
    const i = node.InsertStmt
    const from =
      i.onConflictClause?.action === 'ONCONFLICT_UPDATE'
        ? 'upsert'
        : i.selectStmt !== undefined &&
            'SelectStmt' in i.selectStmt &&
            i.selectStmt.SelectStmt.valuesLists === undefined
          ? 'select'
          : undefined
    return dataChange(i.relation, 'insert', from === undefined ? {} : { from })
  }
  if ('UpdateStmt' in node) {
    const u = node.UpdateStmt
    const nulls = (u.targetList ?? []).flatMap((target) => {
      if (!('ResTarget' in target)) return []
      const { name, val } = target.ResTarget
      return name !== undefined && val !== undefined && 'A_Const' in val && val.A_Const.isnull
        ? [name]
        : []
    })
    const onlyNulls = nulls.length > 0 && nulls.length === (u.targetList ?? []).length
    return dataChange(u.relation, 'update', {
      ...rowsOf(u.whereClause, u.returningClause, ctx),
      ...(nulls.length > 0 ? { nulls } : {}),
      ...(onlyNulls ? { onlyNulls: true as const } : {}),
    })
  }
  if ('DeleteStmt' in node) {
    const d = node.DeleteStmt
    return dataChange(d.relation, 'delete', rowsOf(d.whereClause, d.returningClause, ctx))
  }
  if ('MergeStmt' in node) return dataChange(node.MergeStmt.relation, 'merge', {})
  if ('DoStmt' in node) return [unanalyzable(DO_REASON)]
  if ('CreateFunctionStmt' in node) return [unanalyzable(FUNCTION_REASON)]

  const [type] = Object.keys(node)
  if (type !== undefined && NO_OP_STATEMENTS.has(type)) return []
  return [unanalyzable(`This kind of statement (${type ?? 'unknown'}) is not analyzed`)]
}

type DataChange = Extract<OperationBody, { kind: 'data_change' }>

function dataChange(
  relation: RangeVar | undefined,
  statement: DataChange['statement'],
  details: Partial<Pick<DataChange, 'rows' | 'where' | 'nulls' | 'onlyNulls' | 'from'>>,
): OperationBody[] {
  return relation === undefined
    ? []
    : [{ kind: 'data_change', table: table(relation), statement, ...details }]
}

/** Longest WHERE condition kept for messages. */
const MAX_WHERE = 120

/**
 * Whether a WHERE limits the rows of an UPDATE or DELETE, and the condition as written: from
 * its first token to RETURNING or the end of the statement.
 */
function rowsOf(
  where: Node | undefined,
  returning: unknown,
  ctx: MapContext,
): Pick<DataChange, 'rows' | 'where'> {
  if (where === undefined) return { rows: 'all' }
  const start = firstLocation(where)
  if (start === undefined) return { rows: 'where' }
  const from = ctx.offsets.toIndex(start)
  const returnAt = returning === undefined ? undefined : firstLocation(returning)
  let to = ctx.end
  if (returnAt !== undefined) {
    const keyword = ctx.sql
      .slice(0, ctx.offsets.toIndex(returnAt))
      .toLowerCase()
      .lastIndexOf('returning')
    if (keyword > from) to = keyword
  }
  const text = ctx.sql
    .slice(from, to)
    .replace(/\s+/g, ' ')
    .replace(/[\s;]+$/, '')
    .trim()
  return {
    rows: 'where',
    where: text.length > MAX_WHERE ? `${text.slice(0, MAX_WHERE - 3)}...` : text,
  }
}

/** The smallest source location anywhere inside an AST node. */
function firstLocation(node: unknown): number | undefined {
  let min: number | undefined
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const v of value) walk(v)
      return
    }
    if (typeof value !== 'object' || value === null) return
    for (const [key, v] of Object.entries(value)) {
      if (key === 'location' && typeof v === 'number' && v >= 0) {
        if (min === undefined || v < min) min = v
      } else {
        walk(v)
      }
    }
  }
  walk(node)
  return min
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
      const withMods = mods.length > 0 && isBuiltin(col?.typeName) ? { ...op, toTypmods: mods } : op
      const cut = col?.raw_default === undefined ? undefined : truncation(col.raw_default)
      return [cut === undefined ? withMods : { ...withMods, truncates: cut }]
    }
    case 'AT_ColumnDefault':
      // DROP DEFAULT has no expression and needs no analysis.
      return def === undefined ? [] : [{ kind: 'set_default', table: t, column: cmd.name ?? '' }]
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
        extra.push(addConstraint(c, t))
        break
      case 'CONSTR_FOREIGN': {
        // An inline REFERENCES names no columns: the foreign key is the column being added.
        const fk = addConstraint(c, t)
        extra.push(
          fk.kind === 'add_constraint' && fk.columns === undefined
            ? sortKeys({ ...fk, columns: [col.colname ?? ''] })
            : fk,
        )
        break
      }
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
  if (type === 'foreign_key') {
    const columns = (c.fk_attrs ?? []).flatMap((n) => ('String' in n ? [n.String.sval ?? ''] : []))
    if (columns.length > 0) op.columns = columns
    if (c.fk_matchtype === 'f') op.match = 'full'
  }
  if (type === 'check' && c.raw_expr !== undefined) op.check = checkExpr(c.raw_expr)
  return Object.keys(op).length === 4 ? op : sortKeys(op)
}

/** Keeps a stable key order: kind, table, name, type, notValid, usingIndex, references, ... */
function sortKeys(
  op: Extract<OperationBody, { kind: 'add_constraint' }>,
): Extract<OperationBody, { kind: 'add_constraint' }> {
  const { kind, table: t, name, type, notValid, usingIndex, references, columns, match, check } = op
  return {
    kind,
    table: t,
    ...(name === undefined ? {} : { name }),
    type,
    notValid,
    ...(usingIndex === undefined ? {} : { usingIndex }),
    ...(references === undefined ? {} : { references }),
    ...(columns === undefined ? {} : { columns }),
    ...(match === undefined ? {} : { match }),
    ...(check === undefined ? {} : { check }),
  }
}

/** Built-in functions that keep only part of a value: some characters, or fewer digits. */
const TRUNCATING_FUNCTIONS = new Set([
  'left',
  'right',
  'substr',
  'substring',
  'split_part',
  'trunc',
  'round',
  'date_trunc',
])

/** Types that an explicit cast with a length silently cuts to that length. */
const TRUNCATING_CASTS = new Set(['varchar', 'bpchar', 'char', 'character', 'character varying'])

/**
 * The first part of a USING expression that keeps only part of each value: a function such as
 * `left()`, or an explicit cast to `varchar(n)`, which cuts longer values without an error.
 */
function truncation(node: Node): string | undefined {
  if ('FuncCall' in node) {
    const name = node.FuncCall.funcname?.at(-1)
    const fn = name !== undefined && 'String' in name ? (name.String.sval ?? '') : ''
    if (TRUNCATING_FUNCTIONS.has(fn.toLowerCase())) return `${fn.toLowerCase()}()`
  }
  if ('TypeCast' in node && node.TypeCast.typeName !== undefined) {
    const tn = node.TypeCast.typeName
    const base = lastName(tn)?.toLowerCase()
    const mods = typmods(tn)
    if (base !== undefined && TRUNCATING_CASTS.has(base) && mods.length > 0 && isBuiltin(tn)) {
      return `a cast to ${typeString(tn)}`
    }
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    for (const child of children(value)) {
      const found = truncation(child)
      if (found !== undefined) return found
    }
  }
  return undefined
}

/** AST nodes directly inside a node's field. */
function children(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(children)
  if (typeof value !== 'object' || value === null) return []
  const keys = Object.keys(value)
  // A node is an object with one key naming its type, such as { FuncCall: {...} }.
  if (keys.length === 1 && /^[A-Z]/.test(keys[0] ?? '')) return [value as Node]
  return Object.values(value).flatMap(children)
}

/** Built-in functions that return NULL when any argument is NULL (they are STRICT). */
const STRICT_FUNCTIONS = new Set([
  'length',
  'char_length',
  'character_length',
  'octet_length',
  'lower',
  'upper',
  'btrim',
  'ltrim',
  'rtrim',
  'abs',
  'round',
  'floor',
  'ceil',
  'ceiling',
  'trunc',
  'date_trunc',
  'date_part',
  'left',
  'right',
  'substr',
  'substring',
])

/** A_Expr kinds that are NULL when their left operand is NULL, whatever the right one is. */
const NULL_WITH_LEFT = new Set([
  'AEXPR_OP_ANY',
  'AEXPR_OP_ALL',
  'AEXPR_IN',
  'AEXPR_BETWEEN',
  'AEXPR_NOT_BETWEEN',
  'AEXPR_BETWEEN_SYM',
  'AEXPR_NOT_BETWEEN_SYM',
])

/** NULL when either operand is NULL. */
const NULL_WITH_EITHER = new Set(['AEXPR_OP', 'AEXPR_LIKE', 'AEXPR_ILIKE', 'AEXPR_SIMILAR'])

/** Reduces a CHECK expression to the parts that decide whether NULLs can make it false. */
function checkExpr(node: Node): CheckExpr {
  if ('ColumnRef' in node) {
    const last = node.ColumnRef.fields?.at(-1)
    return last !== undefined && 'String' in last
      ? { kind: 'column', name: last.String.sval ?? '' }
      : { kind: 'other' }
  }
  if ('A_Const' in node) return node.A_Const.isnull === true ? { kind: 'null' } : { kind: 'value' }
  if ('TypeCast' in node) {
    return node.TypeCast.arg === undefined ? { kind: 'other' } : checkExpr(node.TypeCast.arg)
  }
  if ('NullTest' in node) {
    const arg = node.NullTest.arg
    if (arg === undefined) return { kind: 'other' }
    return {
      kind: node.NullTest.nulltesttype === 'IS_NOT_NULL' ? 'is_not_null' : 'is_null',
      arg: checkExpr(arg),
    }
  }
  if ('BoolExpr' in node) {
    const args = (node.BoolExpr.args ?? []).map(checkExpr)
    switch (node.BoolExpr.boolop) {
      case 'AND_EXPR':
        return { kind: 'and', args }
      case 'OR_EXPR':
        return { kind: 'or', args }
      case 'NOT_EXPR':
        return args[0] === undefined ? { kind: 'other' } : { kind: 'not', arg: args[0] }
      default:
        return { kind: 'other' }
    }
  }
  if ('A_Expr' in node) {
    const { kind, lexpr, rexpr } = node.A_Expr
    if (kind !== undefined && NULL_WITH_LEFT.has(kind) && lexpr !== undefined) {
      return { kind: 'strict', args: [checkExpr(lexpr)] }
    }
    if (kind !== undefined && NULL_WITH_EITHER.has(kind)) {
      return {
        kind: 'strict',
        args: [lexpr, rexpr].flatMap((n) => (n === undefined ? [] : [checkExpr(n)])),
      }
    }
    return { kind: 'other' }
  }
  if ('FuncCall' in node) {
    const name = node.FuncCall.funcname?.at(-1)
    const fn = name !== undefined && 'String' in name ? (name.String.sval ?? '') : ''
    if (STRICT_FUNCTIONS.has(fn.toLowerCase())) {
      return { kind: 'strict', args: (node.FuncCall.args ?? []).map(checkExpr) }
    }
    return { kind: 'other' }
  }
  if ('A_ArrayExpr' in node) return { kind: 'value' }
  return { kind: 'other' }
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
