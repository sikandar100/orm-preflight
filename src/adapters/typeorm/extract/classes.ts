import type * as t from '@babel/types'
import { keyName, span, unwrap } from './parse.js'

type ClassNode = t.ClassDeclaration | t.ClassExpression
export type MigrationFunction = t.ClassMethod | t.FunctionExpression | t.ArrowFunctionExpression

/** A migration-shaped class exported from the file. */
export interface MigrationClass {
  node: ClassNode
  /** The class name, or undefined for an anonymous class. */
  className: string | undefined
  /** The `name` property: a string, 'unknown' if not a literal, or undefined if absent. */
  name: t.Node | undefined
  /** The `transaction` property: its value node, or undefined if absent. */
  transaction: t.Node | undefined
  up: MigrationFunction
  down: MigrationFunction | undefined
}

/**
 * Finds exported classes with an `up` method. TypeORM loads migrations from a module's
 * exports, so unexported classes never run. Supports ES module exports, `module.exports`,
 * and TypeScript's CommonJS output (`exports.X = X`).
 */
export function findMigrationClasses(program: t.Program): MigrationClass[] {
  const locals = new Map<string, ClassNode>()
  const exported = new Set<ClassNode>()
  /** JavaScript names `const X = class {}` after the variable, and TypeORM reads that name. */
  const inferredNames = new Map<ClassNode, string>()

  const markExported = (node: t.Node | null | undefined): void => {
    if (!node) return
    const n = unwrap(node)
    if (n.type === 'ClassExpression' || n.type === 'ClassDeclaration') exported.add(n)
    else if (n.type === 'Identifier') {
      const local = locals.get(n.name)
      if (local) exported.add(local)
    } else if (n.type === 'ObjectExpression') {
      for (const p of n.properties) {
        if (p.type === 'ObjectProperty') markExported(p.value)
      }
    }
  }

  // First pass: local classes, so later export statements can refer to them.
  for (const statement of program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration'
        ? statement.declaration
        : statement
    if (declaration?.type === 'ClassDeclaration' && declaration.id) {
      locals.set(declaration.id.name, declaration)
    } else if (declaration?.type === 'VariableDeclaration') {
      for (const d of declaration.declarations) {
        const init = d.init ? unwrap(d.init) : undefined
        if (d.id.type === 'Identifier' && init?.type === 'ClassExpression') {
          locals.set(d.id.name, init)
          inferredNames.set(init, d.id.name)
        }
      }
    }
  }

  for (const statement of program.body) {
    switch (statement.type) {
      case 'ExportNamedDeclaration':
        if (statement.declaration?.type === 'ClassDeclaration') markExported(statement.declaration)
        if (statement.declaration?.type === 'VariableDeclaration') {
          for (const d of statement.declaration.declarations) markExported(d.init)
        }
        if (!statement.source) {
          for (const s of statement.specifiers) {
            if (s.type === 'ExportSpecifier') markExported(s.local)
          }
        }
        break
      case 'ExportDefaultDeclaration':
        markExported(statement.declaration)
        break
      case 'ExpressionStatement': {
        const e = statement.expression
        if (e.type === 'AssignmentExpression' && e.operator === '=' && isCommonJsExport(e.left)) {
          markExported(e.right)
        }
        break
      }
      default:
        break
    }
  }

  return [...exported]
    .map((node) => toMigration(node, node.id?.name ?? inferredNames.get(node)))
    .filter((m): m is MigrationClass => m !== undefined)
    .sort((a, b) => span(a.node).start - span(b.node).start)
}

/** `module.exports`, `module.exports.X`, or `exports.X`. */
function isCommonJsExport(node: t.Node): boolean {
  if (node.type !== 'MemberExpression') return false
  const { object } = node
  if (object.type === 'Identifier') {
    if (object.name === 'exports') return true
    return object.name === 'module' && keyName(node.property, node.computed) === 'exports'
  }
  return (
    object.type === 'MemberExpression' &&
    object.object.type === 'Identifier' &&
    object.object.name === 'module' &&
    keyName(object.property, object.computed) === 'exports'
  )
}

function toMigration(node: ClassNode, className: string | undefined): MigrationClass | undefined {
  let up: MigrationFunction | undefined
  let down: MigrationFunction | undefined
  let name: t.Node | undefined
  let transaction: t.Node | undefined

  for (const member of node.body.body) {
    if (member.type === 'ClassMethod' && !member.static) {
      const key = keyName(member.key, member.computed)
      if (member.kind === 'constructor') {
        // Compiled JavaScript may assign properties in the constructor instead.
        for (const s of member.body.body) {
          const assigned = thisAssignment(s)
          if (assigned?.key === 'name') name = assigned.value
          if (assigned?.key === 'transaction') transaction = assigned.value
        }
      } else if (member.kind === 'method' && key === 'up') up = member
      else if (member.kind === 'method' && key === 'down') down = member
    } else if (member.type === 'ClassProperty' && !member.static && member.value) {
      const key = keyName(member.key, member.computed)
      const value = unwrap(member.value)
      if (key === 'name') name = member.value
      else if (key === 'transaction') transaction = member.value
      else if ((key === 'up' || key === 'down') && isFunction(value)) {
        if (key === 'up') up = value
        else down = value
      }
    }
  }
  if (up === undefined) return undefined
  return { node, className, name, transaction, up, down }
}

function isFunction(node: t.Node): node is t.FunctionExpression | t.ArrowFunctionExpression {
  return node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression'
}

function thisAssignment(
  statement: t.Statement,
): { key: string | undefined; value: t.Node } | undefined {
  if (statement.type !== 'ExpressionStatement') return undefined
  const e = statement.expression
  if (e.type !== 'AssignmentExpression' || e.left.type !== 'MemberExpression') return undefined
  if (e.left.object.type !== 'ThisExpression') return undefined
  return { key: keyName(e.left.property, e.left.computed), value: e.right }
}
