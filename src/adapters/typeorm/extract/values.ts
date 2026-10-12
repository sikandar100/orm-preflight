import type * as t from '@babel/types'
import type { TableRef } from '../../../ir/types.js'
import { decodeEscapes } from './escapes.js'
import { keyName, span, unwrap } from './parse.js'
import { Scope } from './scope.js'

/** A string value and, for each character, the file offset it was written at. */
export type StringResult =
  { ok: true; value: string; offsets: number[] } | { ok: false; reason: string }

export type Value =
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'null' }
  | { kind: 'undefined' }
  | { kind: 'array'; items: Value[] }
  | { kind: 'object'; ctor?: string; props: Map<string, Value>; partial: boolean }
  | { kind: 'table'; table: TableRef }
  | { kind: 'unknown'; reason: string }

const MAX_DEPTH = 32

/** Resolves an expression to a string known at analysis time, without running any code. */
export function resolveString(node: t.Node, text: string, scope: Scope, depth = 0): StringResult {
  if (depth > MAX_DEPTH)
    return {
      ok: false,
      reason: 'SQL is built from a chain of constants that is too deep to follow',
    }
  const n = unwrap(node)

  switch (n.type) {
    case 'StringLiteral':
      return literal(text, span(n).start + 1, span(n).end - 1, n.value, false)
    case 'TemplateLiteral':
      return template(n, text, scope, depth)
    case 'BinaryExpression': {
      if (n.operator !== '+') break
      const left = resolveString(n.left, text, scope, depth + 1)
      if (!left.ok) return left
      const right = resolveString(n.right, text, scope, depth + 1)
      if (!right.ok) return right
      return {
        ok: true,
        value: left.value + right.value,
        offsets: [...left.offsets, ...right.offsets],
      }
    }
    case 'Identifier': {
      const binding = scope.lookup(n.name)
      if (binding?.kind === 'const' && binding.init !== null) {
        return resolveString(binding.init, text, binding.scope, depth + 1)
      }
      if (binding?.kind === 'import') {
        return {
          ok: false,
          reason: `SQL comes from "${n.name}", which is imported from another file`,
        }
      }
      return {
        ok: false,
        reason: `SQL comes from "${n.name}", which is not a constant string in this file`,
      }
    }
    case 'CallExpression':
      return call(n, text, scope, depth) ?? { ok: false, reason: 'SQL comes from a function call' }
    case 'OptionalCallExpression':
      return { ok: false, reason: 'SQL comes from a function call' }
    case 'MemberExpression': {
      const target = member(n, scope, depth)
      if (target !== undefined) return resolveString(target.node, text, target.scope, depth + 1)
      return { ok: false, reason: 'SQL comes from a property read' }
    }
    case 'OptionalMemberExpression':
      return { ok: false, reason: 'SQL comes from a property read' }
    default:
      break
  }
  return { ok: false, reason: 'SQL is built by an expression the extractor cannot follow' }
}

/**
 * A template literal, with each `${...}` replaced by its value when that is known from this
 * file. Every character keeps the position where it is written, so findings point at the
 * right line even when the text comes from a constant or a helper.
 */
function template(n: t.TemplateLiteral, text: string, scope: Scope, depth: number): StringResult {
  let value = ''
  const offsets: number[] = []
  for (const [i, quasi] of n.quasis.entries()) {
    const cooked = quasi.value.cooked
    if (cooked == null)
      return { ok: false, reason: 'SQL template literal contains an invalid escape' }
    const part = literal(text, span(quasi).start, span(quasi).end, cooked, true)
    if (!part.ok) return part
    value += part.value
    append(offsets, part.offsets)
    const expr = n.expressions[i]
    if (expr === undefined) continue
    const inner = interpolated(expr, text, scope, depth + 1)
    if (!inner.ok) {
      const source = text.slice(span(expr).start, span(expr).end).replace(/\s+/g, ' ')
      const shown = source.length > 40 ? `${source.slice(0, 37)}...` : source
      return {
        ok: false,
        reason: `SQL is built from a template literal, and \${${shown}} is not known: ${inner.reason}`,
      }
    }
    value += inner.value
    append(offsets, inner.offsets)
  }
  return { ok: true, value, offsets }
}

/**
 * The text of one `${...}`: a string, or a number literal as it is written, such as
 * `const ACTIVE = 1`.
 */
function interpolated(expr: t.Node, text: string, scope: Scope, depth: number): StringResult {
  const s = resolveString(expr, text, scope, depth)
  if (s.ok) return s
  const target = definition(expr, scope, depth)
  const n = target?.node
  if (n?.type === 'NumericLiteral' || n?.type === 'BooleanLiteral') {
    const { start, end } = span(n)
    const written = text.slice(start, end)
    if (written === String(n.value)) {
      return { ok: true, value: written, offsets: Array.from(written, (_, i) => start + i) }
    }
  }
  const value = resolveValue(expr, text, scope, depth)
  return { ok: false, reason: value.kind === 'unknown' ? value.reason : 'it is not a string' }
}

/**
 * A call whose result is a known string: `.join(sep)` on a known array, `.replace()` or
 * `.replaceAll()` with plain strings, or a same-file function whose body is a string
 * expression. Returns undefined when the call is none of these.
 */
function call(
  n: t.CallExpression,
  text: string,
  scope: Scope,
  depth: number,
): StringResult | undefined {
  const args = n.arguments.flatMap((a) =>
    a.type === 'SpreadElement' || a.type === 'ArgumentPlaceholder' ? [] : [a],
  )
  if (args.length !== n.arguments.length) return undefined
  const callee = unwrap(n.callee)

  if (callee.type === 'MemberExpression' && !callee.computed) {
    const method = keyName(callee.property, false)
    const strings = args.map((a) => resolveString(a, text, scope, depth + 1))
    if (!strings.every((r) => r.ok)) return undefined
    if (method === 'join') {
      const items = arrayElements(callee.object, scope)
      if (items === undefined) return undefined
      const separator = strings[0] ?? { ok: true, value: ',', offsets: [] }
      if (strings.length > 1 || (strings[0] === undefined && items.length > 1)) return undefined
      let value = ''
      const offsets: number[] = []
      for (const [i, item] of items.entries()) {
        const r = resolveString(item.node, text, item.scope, depth + 1)
        if (!r.ok) return undefined
        if (i > 0) {
          value += separator.value
          append(offsets, separator.offsets)
        }
        value += r.value
        append(offsets, r.offsets)
      }
      return { ok: true, value, offsets }
    }
    if ((method === 'replace' || method === 'replaceAll') && strings.length === 2) {
      const target = resolveString(callee.object, text, scope, depth + 1)
      const [find, by] = strings
      if (!target.ok || find === undefined || by === undefined || find.value === '')
        return undefined
      return replaceText(target, find.value, by, method === 'replaceAll')
    }
    return undefined
  }

  const fn = stringFunction(callee, scope)
  if (fn === undefined || fn.params.length < args.length) return undefined
  const inner = new Scope(fn.scope)
  for (const [i, param] of fn.params.entries()) {
    const arg = args[i]
    if (param.type !== 'Identifier' || arg === undefined) return undefined
    inner.declare(param.name, { kind: 'const', init: arg, scope })
  }
  const result = resolveString(fn.body, text, inner, depth + 1)
  return result.ok ? result : { ok: false, reason: result.reason }
}

/**
 * A same-file function whose result is a string expression: `(t) => \`...\``, or a body
 * that only returns one. Async functions and generators do not return strings.
 */
function stringFunction(
  callee: t.Node,
  scope: Scope,
): { params: t.Node[]; body: t.Node; scope: Scope } | undefined {
  if (callee.type !== 'Identifier') return undefined
  const binding = scope.lookup(callee.name)
  let fn: t.Node | null | undefined
  let fnScope: Scope | undefined
  if (binding?.kind === 'function') {
    fn = binding.node
    fnScope = binding.scope
  } else if (binding?.kind === 'const' && binding.init !== null) {
    fn = unwrap(binding.init)
    fnScope = binding.scope
  }
  if (
    fn === null ||
    fn === undefined ||
    fnScope === undefined ||
    (fn.type !== 'ArrowFunctionExpression' &&
      fn.type !== 'FunctionExpression' &&
      fn.type !== 'FunctionDeclaration') ||
    fn.async ||
    fn.generator
  ) {
    return undefined
  }
  if (fn.body.type !== 'BlockStatement') return { params: fn.params, body: fn.body, scope: fnScope }
  const [only] = fn.body.body
  if (fn.body.body.length !== 1 || only?.type !== 'ReturnStatement' || !only.argument) {
    return undefined
  }
  return { params: fn.params, body: only.argument, scope: fnScope }
}

/** Replaces the first (or every) occurrence of `find`, keeping each character's position. */
function replaceText(
  target: { value: string; offsets: number[] },
  find: string,
  by: { value: string; offsets: number[] },
  all: boolean,
): StringResult {
  let value = ''
  const offsets: number[] = []
  let from = 0
  for (;;) {
    const at = target.value.indexOf(find, from)
    if (at === -1) break
    value += target.value.slice(from, at) + by.value
    append(offsets, target.offsets.slice(from, at))
    append(offsets, by.offsets)
    from = at + find.length
    if (!all) break
  }
  value += target.value.slice(from)
  append(offsets, target.offsets.slice(from))
  return { ok: true, value, offsets }
}

/** A node and the scope its names resolve in. */
export interface ScopedNode {
  node: t.Node
  scope: Scope
}

/** Follows const names to the expression they hold. */
function definition(node: t.Node, scope: Scope, depth: number): ScopedNode | undefined {
  if (depth > MAX_DEPTH) return undefined
  const n = unwrap(node)
  if (n.type === 'Identifier') {
    const binding = scope.lookup(n.name)
    if (binding?.kind === 'const' && binding.init !== null) {
      return definition(binding.init, binding.scope, depth + 1)
    }
    if (binding?.kind === 'class') return { node: binding.node, scope: binding.scope }
    return undefined
  }
  if (n.type === 'MemberExpression') {
    const target = member(n, scope, depth + 1)
    return target === undefined ? undefined : definition(target.node, target.scope, depth + 1)
  }
  return { node: n, scope }
}

/**
 * The expression a property read refers to: a property of a const object literal, or a
 * static property of a class in this file, such as `Migration.TABLES`.
 */
function member(n: t.MemberExpression, scope: Scope, depth: number): ScopedNode | undefined {
  const name = keyName(n.property, n.computed)
  if (name === undefined) return undefined
  const owner = definition(n.object, scope, depth + 1)
  if (owner === undefined) return undefined
  if (owner.node.type === 'ObjectExpression') {
    for (const p of owner.node.properties) {
      if (p.type === 'ObjectProperty' && keyName(p.key, p.computed) === name) {
        return { node: p.value, scope: owner.scope }
      }
    }
    return undefined
  }
  if (owner.node.type === 'ClassDeclaration') {
    for (const m of owner.node.body.body) {
      if (
        m.type === 'ClassProperty' &&
        m.static &&
        m.value &&
        keyName(m.key, m.computed) === name
      ) {
        return { node: m.value, scope: owner.scope }
      }
    }
  }
  return undefined
}

/**
 * The elements of an array literal that a name or property refers to, such as
 * `Migration.TABLES` for `static readonly TABLES = ['a', 'b']`. Undefined when any element is
 * a spread or a hole, or the array cannot be found.
 */
export function arrayElements(node: t.Node, scope: Scope): ScopedNode[] | undefined {
  const target = definition(node, scope, 0)
  if (target?.node.type !== 'ArrayExpression') return undefined
  const elements: ScopedNode[] = []
  for (const e of target.node.elements) {
    if (e === null || e.type === 'SpreadElement') return undefined
    elements.push({ node: e, scope: target.scope })
  }
  return elements
}

function literal(
  text: string,
  start: number,
  end: number,
  cooked: string,
  template: boolean,
): StringResult {
  const decoded = decodeEscapes(text.slice(start, end), template)
  if (decoded?.cooked === cooked) {
    return { ok: true, value: cooked, offsets: decoded.source.map((i) => start + i) }
  }
  // Should not happen for valid code. Keep the value and point every character at the literal.
  return { ok: true, value: cooked, offsets: Array.from(cooked, () => start) }
}

const TABLE_CLASSES = new Set([
  'Table',
  'TableColumn',
  'TableIndex',
  'TableForeignKey',
  'TableUnique',
  'TableCheck',
  'TableExclusion',
])

/** Resolves an expression to a plain value, as far as that is possible without running code. */
export function resolveValue(node: t.Node, text: string, scope: Scope, depth = 0): Value {
  if (depth > MAX_DEPTH) return { kind: 'unknown', reason: 'it is nested too deeply to follow' }
  const n = unwrap(node)

  switch (n.type) {
    case 'StringLiteral':
    case 'TemplateLiteral':
    case 'BinaryExpression': {
      const s = resolveString(n, text, scope, depth + 1)
      return s.ok ? { kind: 'string', value: s.value } : { kind: 'unknown', reason: s.reason }
    }
    case 'MemberExpression': {
      const target = member(n, scope, depth + 1)
      if (target !== undefined) return resolveValue(target.node, text, target.scope, depth + 1)
      break
    }
    case 'NumericLiteral':
      return { kind: 'number', value: n.value }
    case 'UnaryExpression':
      if (n.operator === '-' && n.argument.type === 'NumericLiteral') {
        return { kind: 'number', value: -n.argument.value }
      }
      break
    case 'BooleanLiteral':
      return { kind: 'boolean', value: n.value }
    case 'NullLiteral':
      return { kind: 'null' }
    case 'ArrayExpression':
      return {
        kind: 'array',
        items: n.elements.map((e) =>
          e === null || e.type === 'SpreadElement'
            ? { kind: 'unknown', reason: 'it uses spread syntax' }
            : resolveValue(e, text, scope, depth + 1),
        ),
      }
    case 'ObjectExpression':
      return objectValue(n, text, scope, depth)
    case 'NewExpression': {
      const [arg] = n.arguments
      if (n.callee.type !== 'Identifier' || !TABLE_CLASSES.has(n.callee.name)) break
      if (arg === undefined)
        return { kind: 'object', ctor: n.callee.name, props: new Map(), partial: false }
      const inner = resolveValue(arg, text, scope, depth + 1)
      if (inner.kind !== 'object') break
      return { ...inner, ctor: n.callee.name }
    }
    case 'CallExpression': {
      const called = call(n, text, scope, depth + 1)
      if (called?.ok === true) return { kind: 'string', value: called.value }
      // `table.findColumnByName('x')` on a table from getTable() names column x.
      const callee = unwrap(n.callee)
      const [arg] = n.arguments
      if (
        callee.type === 'MemberExpression' &&
        keyName(callee.property, callee.computed) === 'findColumnByName'
      ) {
        const owner = unwrap(callee.object)
        const bound = owner.type === 'Identifier' ? scope.lookup(owner.name) : undefined
        if (
          bound?.kind === 'table' &&
          arg !== undefined &&
          arg.type !== 'SpreadElement' &&
          arg.type !== 'ArgumentPlaceholder'
        ) {
          const name = resolveValue(arg, text, scope, depth + 1)
          if (name.kind === 'string') return name
        }
      }
      break
    }
    case 'Identifier': {
      const binding = scope.lookup(n.name)
      if (binding === undefined && n.name === 'undefined') return { kind: 'undefined' }
      if (binding?.kind === 'const' && binding.init !== null) {
        return resolveValue(binding.init, text, binding.scope, depth + 1)
      }
      if (binding?.kind === 'table') return { kind: 'table', table: binding.table }
      return { kind: 'unknown', reason: `"${n.name}" is not a constant in this file` }
    }
    default:
      break
  }
  return { kind: 'unknown', reason: describe(n) }
}

/** Why an expression cannot be resolved, in plain words. */
function describe(n: t.Node): string {
  switch (n.type) {
    case 'CallExpression':
    case 'OptionalCallExpression':
    case 'NewExpression':
      return 'it comes from a function call'
    case 'AwaitExpression':
      return 'it comes from an awaited call'
    case 'MemberExpression':
    case 'OptionalMemberExpression':
      return 'it is read from a property'
    default:
      return 'the extractor cannot follow this kind of expression'
  }
}

function objectValue(n: t.ObjectExpression, text: string, scope: Scope, depth: number): Value {
  const props = new Map<string, Value>()
  let partial = false
  for (const p of n.properties) {
    const name = p.type === 'SpreadElement' ? undefined : keyName(p.key, p.computed)
    if (p.type !== 'ObjectProperty' || name === undefined) {
      partial = true
      continue
    }
    props.set(name, resolveValue(p.value, text, scope, depth + 1))
  }
  return { kind: 'object', props, partial }
}

/**
 * Adds every item of `items` to `list`. A loop, not push(...items): SQL in one migration can be
 * hundreds of thousands of characters, more than a function call takes as arguments.
 */
function append(list: number[], items: readonly number[]): void {
  for (const item of items) list.push(item)
}
