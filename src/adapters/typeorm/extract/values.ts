import type * as t from '@babel/types'
import type { TableRef } from '../../../ir/types.js'
import { decodeEscapes } from './escapes.js'
import { keyName, span, unwrap } from './parse.js'
import type { Scope } from './scope.js'

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
    case 'TemplateLiteral': {
      const quasi = n.quasis[0]
      if (n.expressions.length > 0 || quasi === undefined) {
        return { ok: false, reason: 'SQL is built from a template literal with ${...} expressions' }
      }
      const cooked = quasi.value.cooked
      if (cooked == null)
        return { ok: false, reason: 'SQL template literal contains an invalid escape' }
      return literal(text, span(quasi).start, span(quasi).end, cooked, true)
    }
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
    case 'OptionalCallExpression':
      return { ok: false, reason: 'SQL comes from a function call' }
    case 'MemberExpression':
    case 'OptionalMemberExpression':
      return { ok: false, reason: 'SQL comes from a property read' }
    default:
      break
  }
  return { ok: false, reason: 'SQL is built by an expression the extractor cannot follow' }
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
