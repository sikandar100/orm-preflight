import type * as t from '@babel/types'
import type {
  ExtractedStep,
  Loc,
  OperationBody,
  SqlSourceMap,
  SqlSourceRun,
} from '../../../ir/types.js'
import type { Dialect } from '../../../rules/types.js'
import { mapBuilderCall, parseTableName, READ_METHODS, TRANSACTION_METHODS } from '../builder.js'
import type { LineIndex } from './lines.js'
import { keyName, span, unwrap } from './parse.js'
import { patternNames, Scope } from './scope.js'
import { resolveString, resolveValue } from './values.js'

export const HELPER_REASON = 'SQL is built in a helper; use --execute or suppress with a reason'
export const ESCAPE_REASON =
  'queryRunner is stored or passed on in a way the extractor cannot follow; use --execute or suppress with a reason'
export const DYNAMIC_REASON =
  'A QueryRunner method chosen at runtime cannot be analyzed statically; use --execute or suppress with a reason'
export const MANAGER_REASON =
  'Writes through queryRunner.manager or queryRunner.connection cannot be analyzed statically; use --execute or suppress with a reason'

interface Context {
  file: string
  text: string
  lines: LineIndex
  dialect: Dialect
  steps: ExtractedStep[]
}

/** Keys that never contain runtime code worth walking. */
const SKIP_KEYS = new Set([
  'type',
  'start',
  'end',
  'loc',
  'range',
  'extra',
  'leadingComments',
  'trailingComments',
  'innerComments',
  'typeAnnotation',
  'returnType',
  'typeParameters',
  'typeArguments',
  'superTypeParameters',
  'implements',
  'decorators',
])

const FUNCTION_TYPES = new Set([
  'FunctionExpression',
  'ArrowFunctionExpression',
  'FunctionDeclaration',
  'ObjectMethod',
  'ClassMethod',
  'ClassPrivateMethod',
])

type FunctionNode =
  | t.FunctionExpression
  | t.ArrowFunctionExpression
  | t.FunctionDeclaration
  | t.ObjectMethod
  | t.ClassMethod
  | t.ClassPrivateMethod

/**
 * Walks a migration's up() in source order and returns its steps. `moduleScope` holds the
 * file's top-level declarations, so constants declared outside the class resolve.
 */
export function walkUp(
  fn: t.ClassMethod | t.FunctionExpression | t.ArrowFunctionExpression,
  moduleScope: Scope,
  ctx: Omit<Context, 'steps'>,
): ExtractedStep[] {
  const context: Context = { ...ctx, steps: [] }
  const scope = new Scope(moduleScope)
  const params = fn.params.filter((p) => !(p.type === 'Identifier' && p.name === 'this'))
  const [first] = params
  if (first !== undefined) {
    const param = first.type === 'TSParameterProperty' ? first.parameter : first
    const id = param.type === 'AssignmentPattern' ? param.left : param
    if (id.type === 'Identifier') scope.declare(id.name, { kind: 'queryRunner' })
    else {
      unanalyzable(
        context,
        first,
        'The up() parameter is destructured, so QueryRunner calls cannot be followed',
        false,
      )
      return context.steps
    }
  }
  walkFunctionBody(fn.body, scope, context, false)
  return context.steps
}

function walkFunctionBody(body: t.Node, scope: Scope, ctx: Context, conditional: boolean): void {
  if (body.type === 'BlockStatement') walkBlock(body.body, scope, ctx, conditional)
  else {
    if (isQueryRunner(body, scope)) unanalyzable(ctx, body, ESCAPE_REASON, conditional)
    visit(body, scope, ctx, conditional)
  }
}

function walkBlock(
  statements: t.Statement[],
  parent: Scope,
  ctx: Context,
  conditional: boolean,
): void {
  const scope = new Scope(parent)
  scope.declareStatements(statements)
  let cond = conditional
  for (const statement of statements) {
    visit(statement, scope, ctx, cond)
    // Code after a branch that may return or throw only runs on some paths.
    if (!cond && mayExitEarly(statement)) cond = true
  }
}

function visit(node: t.Node, scope: Scope, ctx: Context, cond: boolean): void {
  switch (node.type) {
    case 'BlockStatement':
    case 'StaticBlock':
      walkBlock(node.body, scope, ctx, cond)
      return
    case 'IfStatement':
      visit(node.test, scope, ctx, cond)
      visit(node.consequent, scope, ctx, true)
      if (node.alternate) visit(node.alternate, scope, ctx, true)
      return
    case 'ConditionalExpression':
      visit(node.test, scope, ctx, cond)
      visit(node.consequent, scope, ctx, true)
      visit(node.alternate, scope, ctx, true)
      return
    case 'LogicalExpression':
      visit(node.left, scope, ctx, cond)
      visit(node.right, scope, ctx, true)
      return
    case 'SwitchStatement': {
      visit(node.discriminant, scope, ctx, cond)
      const inner = new Scope(scope)
      inner.declareStatements(node.cases.flatMap((c) => c.consequent))
      for (const c of node.cases) {
        if (c.test) visit(c.test, inner, ctx, true)
        for (const s of c.consequent) visit(s, inner, ctx, true)
      }
      return
    }
    case 'ForStatement': {
      const inner = new Scope(scope)
      if (node.init) {
        inner.declareStatements([node.init])
        visit(node.init, inner, ctx, cond)
      }
      if (node.test) visit(node.test, inner, ctx, true)
      if (node.update) visit(node.update, inner, ctx, true)
      visit(node.body, inner, ctx, true)
      return
    }
    case 'ForInStatement':
    case 'ForOfStatement': {
      visit(node.right, scope, ctx, cond)
      const inner = new Scope(scope)
      inner.declareStatements([node.left])
      visit(node.body, inner, ctx, true)
      return
    }
    case 'WhileStatement':
      visit(node.test, scope, ctx, cond)
      visit(node.body, scope, ctx, true)
      return
    case 'DoWhileStatement':
      visit(node.body, scope, ctx, true)
      visit(node.test, scope, ctx, true)
      return
    case 'TryStatement':
      visit(node.block, scope, ctx, cond)
      if (node.handler) {
        const { param, body } = node.handler
        walkFunctionLike(param ? [param] : [], body, scope, ctx, true)
      }
      if (node.finalizer) visit(node.finalizer, scope, ctx, cond)
      return
    case 'VariableDeclaration':
      for (const d of node.declarations) visitDeclarator(d, node.kind, scope, ctx, cond)
      return
    case 'CallExpression':
    case 'OptionalCallExpression':
      visitCall(node, scope, ctx, cond)
      return
    case 'NewExpression':
      if (node.arguments.some((a) => isQueryRunner(a, scope))) {
        unanalyzable(ctx, node, HELPER_REASON, cond)
        return
      }
      visitChildren(node, scope, ctx, cond)
      return
    case 'MemberExpression':
    case 'OptionalMemberExpression':
      // Reading a property of queryRunner (queryRunner.connection.options) is harmless.
      if (!isQueryRunner(node.object, scope)) visit(node.object, scope, ctx, cond)
      if (node.computed) visit(node.property, scope, ctx, cond)
      return
    case 'AssignmentExpression':
      if (isQueryRunner(node.right, scope)) unanalyzable(ctx, node, ESCAPE_REASON, cond)
      else visitChildren(node, scope, ctx, cond)
      return
    case 'ReturnStatement':
    case 'SpreadElement':
      if (node.argument && isQueryRunner(node.argument, scope))
        unanalyzable(ctx, node, ESCAPE_REASON, cond)
      else visitChildren(node, scope, ctx, cond)
      return
    case 'ObjectProperty':
      if (isQueryRunner(node.value, scope)) unanalyzable(ctx, node, ESCAPE_REASON, cond)
      else visitChildren(node, scope, ctx, cond)
      return
    case 'ArrayExpression':
      for (const e of node.elements) {
        if (e && isQueryRunner(e, scope)) unanalyzable(ctx, e, ESCAPE_REASON, cond)
        else if (e) visit(e, scope, ctx, cond)
      }
      return
    case 'ClassDeclaration':
    case 'ClassExpression':
      for (const member of node.body.body) visit(member, scope, ctx, true)
      return
    default:
      if (FUNCTION_TYPES.has(node.type)) {
        const fn = node as FunctionNode
        // Callbacks may run any number of times, or not at all.
        walkFunctionLike(fn.params, fn.body, scope, ctx, true)
        return
      }
      visitChildren(node, scope, ctx, cond)
  }
}

function walkFunctionLike(
  params: t.Node[],
  body: t.Node,
  parent: Scope,
  ctx: Context,
  cond: boolean,
): void {
  const scope = new Scope(parent)
  for (const p of params) {
    // A parameter with the same name shadows queryRunner inside the function.
    for (const name of patternNames(p)) scope.declare(name, { kind: 'mutable' })
  }
  walkFunctionBody(body, scope, ctx, cond)
}

function visitChildren(node: t.Node, scope: Scope, ctx: Context, cond: boolean): void {
  const children: t.Node[] = []
  for (const [key, value] of Object.entries(node)) {
    if (SKIP_KEYS.has(key)) continue
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) children.push(item)
    } else if (isNode(value)) children.push(value)
  }
  children.sort((a, b) => span(a).start - span(b).start)
  for (const child of children) {
    if (child.type.startsWith('TS') && !isTsExpression(child)) continue
    visit(child, scope, ctx, cond)
  }
}

function isNode(value: unknown): value is t.Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  )
}

function isTsExpression(node: t.Node): boolean {
  return (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSTypeAssertion' ||
    node.type === 'TSInstantiationExpression' ||
    node.type === 'TSParameterProperty'
  )
}

function visitDeclarator(
  d: t.VariableDeclarator,
  kind: t.VariableDeclaration['kind'],
  scope: Scope,
  ctx: Context,
  cond: boolean,
): void {
  const init = d.init ? unwrap(d.init) : undefined
  if (init === undefined) return
  if (isQueryRunner(init, scope)) {
    // `const qr = queryRunner` is an alias. Destructuring it hides the calls.
    if (d.id.type === 'Identifier') scope.declare(d.id.name, { kind: 'queryRunner' })
    else unanalyzable(ctx, d, ESCAPE_REASON, cond)
    return
  }
  visit(init, scope, ctx, cond)

  // `const table = await queryRunner.getTable('users')` lets later calls name the table.
  const call = init.type === 'AwaitExpression' ? unwrap(init.argument) : init
  if (d.id.type === 'Identifier' && kind !== 'var' && call.type === 'CallExpression') {
    const method = queryRunnerMethod(call, scope)
    const [arg] = call.arguments
    if (method === 'getTable' && arg !== undefined) {
      const value = resolveValue(arg, ctx.text, scope)
      if (value.kind === 'string')
        scope.declare(d.id.name, { kind: 'table', table: parseTableName(value.value) })
    }
  }
}

function visitCall(
  node: t.CallExpression | t.OptionalCallExpression,
  scope: Scope,
  ctx: Context,
  cond: boolean,
): void {
  const method = queryRunnerMethod(node, scope)
  if (method !== undefined) {
    handleQueryRunnerCall(node, method, scope, ctx, cond)
    return
  }
  if (isDynamicQueryRunnerCall(node, scope)) {
    unanalyzable(ctx, node, DYNAMIC_REASON, cond)
    return
  }

  const via = managerOrConnectionCall(node, scope)
  if (via === 'query') {
    handleQueryRunnerCall(node, 'query', scope, ctx, cond)
    return
  }
  if (via === 'other') {
    unanalyzable(ctx, node, MANAGER_REASON, cond)
    return
  }

  // TypeScript's compiled output wraps async bodies in __awaiter(this, ..., function* () {}).
  // The wrapped body runs exactly once, so it is not conditional.
  if (isAwaiter(node.callee)) {
    const body = node.arguments.at(-1)
    if (body?.type === 'FunctionExpression') {
      walkFunctionLike(body.params, body.body, scope, ctx, cond)
      return
    }
  }

  if (node.arguments.some((a) => isQueryRunner(a, scope))) {
    unanalyzable(ctx, node, HELPER_REASON, cond)
    return
  }
  visitChildren(node, scope, ctx, cond)
}

function handleQueryRunnerCall(
  node: t.CallExpression | t.OptionalCallExpression,
  method: string,
  scope: Scope,
  ctx: Context,
  cond: boolean,
): void {
  const args = node.arguments
  if (method === 'query') {
    const [sqlArg, ...rest] = args
    if (sqlArg === undefined) {
      unanalyzable(ctx, node, 'query() is called without SQL', cond)
      return
    }
    const resolved = resolveString(sqlArg, ctx.text, scope)
    if (resolved.ok) {
      const step: ExtractedStep = {
        kind: 'sql',
        sql: resolved.value,
        loc: locOf(ctx, node),
        map: sqlMap(ctx, resolved.offsets, span(sqlArg).start),
      }
      if (cond) step.conditional = true
      ctx.steps.push(step)
    } else {
      unanalyzable(ctx, node, resolved.reason, cond, 'sql')
    }
    for (const arg of rest) visit(arg, scope, ctx, cond)
    return
  }

  if (READ_METHODS.has(method)) {
    for (const arg of args) visit(arg, scope, ctx, cond)
    return
  }

  const action = TRANSACTION_METHODS[method]
  if (action !== undefined) {
    operation(ctx, node, { kind: 'typeorm.transaction_control', action }, cond)
    return
  }

  const values = args.map((a) =>
    a.type === 'SpreadElement' || a.type === 'ArgumentPlaceholder'
      ? ({ kind: 'unknown', reason: 'it uses spread syntax' } as const)
      : resolveValue(a, ctx.text, scope),
  )
  const result = mapBuilderCall(method, values, ctx.dialect)
  if (result.ok) for (const op of result.ops) operation(ctx, node, op, cond)
  else unanalyzable(ctx, node, result.reason, cond)
}

/** The method name when `node` is `<queryRunner>.<method>(...)`. */
function queryRunnerMethod(
  node: t.CallExpression | t.OptionalCallExpression,
  scope: Scope,
): string | undefined {
  const callee = unwrap(node.callee)
  if (callee.type !== 'MemberExpression' && callee.type !== 'OptionalMemberExpression')
    return undefined
  if (!isQueryRunner(callee.object, scope)) return undefined
  return keyName(callee.property, callee.computed)
}

/** `queryRunner[name](...)` where the method name is not a constant. */
function isDynamicQueryRunnerCall(
  node: t.CallExpression | t.OptionalCallExpression,
  scope: Scope,
): boolean {
  const callee = unwrap(node.callee)
  return (
    (callee.type === 'MemberExpression' || callee.type === 'OptionalMemberExpression') &&
    isQueryRunner(callee.object, scope) &&
    keyName(callee.property, callee.computed) === undefined
  )
}

/** Methods on queryRunner.connection that write or open another way to write. */
const CONNECTION_WRITES = new Set([
  'query',
  'createQueryRunner',
  'transaction',
  'createQueryBuilder',
  'getRepository',
  'getTreeRepository',
])

/** Classifies `queryRunner.manager.x(...)` and `queryRunner.connection.x(...)` calls. */
function managerOrConnectionCall(
  node: t.CallExpression | t.OptionalCallExpression,
  scope: Scope,
): 'query' | 'other' | undefined {
  const callee = unwrap(node.callee)
  if (callee.type !== 'MemberExpression' && callee.type !== 'OptionalMemberExpression')
    return undefined
  let object = unwrap(callee.object)
  const path: string[] = []
  while (object.type === 'MemberExpression' || object.type === 'OptionalMemberExpression') {
    path.unshift(keyName(object.property, object.computed) ?? '?')
    object = unwrap(object.object)
  }
  if (!isQueryRunner(object, scope)) return undefined
  const [first, second] = path
  const method = keyName(callee.property, callee.computed)
  if (first === 'manager') return path.length === 1 && method === 'query' ? 'query' : 'other'
  if (first !== 'connection') return undefined
  if (second === 'manager') return 'other'
  // Reads such as connection.getMetadata(X) or connection.driver.escape(name) write nothing.
  return path.length === 1 && method !== undefined && CONNECTION_WRITES.has(method)
    ? 'other'
    : undefined
}

function isAwaiter(callee: t.Node): boolean {
  const c = unwrap(callee)
  if (c.type === 'Identifier') return c.name.endsWith('__awaiter')
  if (c.type === 'MemberExpression') return keyName(c.property, c.computed) === '__awaiter'
  if (c.type === 'SequenceExpression') {
    const last = c.expressions.at(-1)
    return last !== undefined && isAwaiter(last)
  }
  return false
}

function isQueryRunner(node: t.Node, scope: Scope): boolean {
  const n = unwrap(node)
  return n.type === 'Identifier' && scope.lookup(n.name)?.kind === 'queryRunner'
}

/** True when a statement contains a return or throw outside nested functions. */
function mayExitEarly(statement: t.Node): boolean {
  if (statement.type === 'ReturnStatement' || statement.type === 'ThrowStatement') return false
  return containsExit(statement)
}

function containsExit(node: t.Node): boolean {
  if (node.type === 'ReturnStatement' || node.type === 'ThrowStatement') return true
  if (
    FUNCTION_TYPES.has(node.type) ||
    node.type === 'ClassDeclaration' ||
    node.type === 'ClassExpression'
  ) {
    return false
  }
  for (const [key, value] of Object.entries(node)) {
    if (SKIP_KEYS.has(key)) continue
    if (Array.isArray(value)) {
      if (value.some((v) => isNode(v) && containsExit(v))) return true
    } else if (isNode(value) && containsExit(value)) return true
  }
  return false
}

function locOf(ctx: Context, node: t.Node): Loc {
  return { file: ctx.file, ...ctx.lines.position(span(node).start) }
}

function operation(ctx: Context, node: t.Node, body: OperationBody, cond: boolean): void {
  const op = { ...body, loc: locOf(ctx, node), origin: 'builder' as const }
  ctx.steps.push({ kind: 'operation', operation: cond ? { ...op, conditional: true } : op })
}

function unanalyzable(
  ctx: Context,
  node: t.Node,
  reason: string,
  cond: boolean,
  origin: 'sql' | 'builder' = 'builder',
): void {
  const op = { kind: 'unanalyzable' as const, reason, loc: locOf(ctx, node), origin }
  ctx.steps.push({ kind: 'operation', operation: cond ? { ...op, conditional: true } : op })
}

function sqlMap(ctx: Context, offsets: number[], fallback: number): SqlSourceMap {
  const runs: SqlSourceRun[] = []
  let previous = -2
  let previousLine = -1
  offsets.forEach((abs, offset) => {
    const { line, column } = ctx.lines.position(abs)
    if (abs !== previous + 1 || line !== previousLine) runs.push({ offset, line, column })
    previous = abs
    previousLine = line
  })
  if (runs.length === 0) runs.push({ offset: 0, ...ctx.lines.position(fallback) })
  return { file: ctx.file, runs }
}
