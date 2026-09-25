import type * as t from '@babel/types'
import type { TableRef } from '../../../ir/types.js'

export type Binding =
  | { kind: 'const'; init: t.Node | null; scope: Scope }
  | { kind: 'mutable' }
  | { kind: 'import' }
  | { kind: 'queryRunner' }
  | { kind: 'table'; table: TableRef }
  /** `this` inside the migration class, so `this.helper(queryRunner)` can be followed. */
  | { kind: 'instance' }
  /** A function declared in the file, so `helper(queryRunner)` can be followed. */
  | { kind: 'function'; node: t.FunctionDeclaration; scope: Scope }

/** Lexical scope, just detailed enough to resolve const strings and QueryRunner aliases. */
export class Scope {
  private readonly bindings = new Map<string, Binding>()

  constructor(readonly parent?: Scope) {}

  declare(name: string, binding: Binding): void {
    this.bindings.set(name, binding)
  }

  lookup(name: string): Binding | undefined {
    return this.bindings.get(name) ?? this.parent?.lookup(name)
  }

  /** Declares everything a statement list introduces, so later statements can see it. */
  declareStatements(statements: readonly t.Node[]): void {
    for (const statement of statements) this.declareStatement(statement)
  }

  private declareStatement(node: t.Node): void {
    switch (node.type) {
      case 'VariableDeclaration':
        for (const declarator of node.declarations) {
          if (declarator.id.type === 'Identifier' && node.kind === 'const') {
            this.declare(declarator.id.name, {
              kind: 'const',
              init: declarator.init ?? null,
              scope: this,
            })
          } else {
            for (const name of patternNames(declarator.id)) this.declare(name, { kind: 'mutable' })
          }
        }
        break
      case 'FunctionDeclaration':
        if (node.id) this.declare(node.id.name, { kind: 'function', node, scope: this })
        break
      case 'ClassDeclaration':
        if (node.id) this.declare(node.id.name, { kind: 'mutable' })
        break
      case 'ImportDeclaration':
        for (const specifier of node.specifiers)
          this.declare(specifier.local.name, { kind: 'import' })
        break
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration':
        if (node.declaration) this.declareStatement(node.declaration)
        break
      default:
        break
    }
  }
}

/** Every identifier a binding pattern declares. */
export function patternNames(node: t.Node): string[] {
  switch (node.type) {
    case 'Identifier':
      return [node.name]
    case 'ObjectPattern':
      return node.properties.flatMap((p) =>
        p.type === 'RestElement' ? patternNames(p.argument) : patternNames(p.value),
      )
    case 'ArrayPattern':
      return node.elements.flatMap((e) => (e === null ? [] : patternNames(e)))
    case 'AssignmentPattern':
      return patternNames(node.left)
    case 'RestElement':
      return patternNames(node.argument)
    case 'TSParameterProperty':
      return patternNames(node.parameter)
    default:
      return []
  }
}
