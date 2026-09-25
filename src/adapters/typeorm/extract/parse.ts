import { parse } from '@babel/parser'
import type * as t from '@babel/types'

export type ParseResult = { ok: true; ast: t.File } | { ok: false; message: string; offset: number }

/** Parses TypeScript or JavaScript source. Never imports or executes it. */
export function parseSource(path: string, text: string): ParseResult {
  try {
    const ast = parse(text, {
      sourceType: path.endsWith('.cjs') ? 'script' : 'module',
      plugins: ['typescript', 'decorators-legacy', 'classProperties'],
      errorRecovery: false,
    })
    return { ok: true, ast }
  } catch (error) {
    const e = error as { message?: unknown; pos?: unknown }
    const message =
      typeof e.message === 'string' ? e.message.replace(/ \(\d+:\d+\)$/, '') : String(error)
    return { ok: false, message, offset: typeof e.pos === 'number' ? e.pos : 0 }
  }
}

/** Start and end offsets of a node. Babel always sets them for parsed nodes. */
export function span(node: t.Node): { start: number; end: number } {
  return { start: node.start ?? 0, end: node.end ?? 0 }
}

/** Removes TypeScript-only wrappers such as `x as const` and `x!`. */
export function unwrap(node: t.Node): t.Node {
  let current = node
  while (
    current.type === 'TSAsExpression' ||
    current.type === 'TSSatisfiesExpression' ||
    current.type === 'TSNonNullExpression' ||
    current.type === 'TSTypeAssertion' ||
    current.type === 'TSInstantiationExpression' ||
    current.type === 'ParenthesizedExpression'
  ) {
    current = current.expression
  }
  return current
}

/** The name of a non-computed property key, or undefined. */
export function keyName(key: t.Node, computed: boolean): string | undefined {
  if (key.type === 'Identifier' && !computed) return key.name
  if (key.type === 'StringLiteral') return key.value
  return undefined
}
