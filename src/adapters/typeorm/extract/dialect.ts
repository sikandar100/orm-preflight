import type * as t from '@babel/types'
import type { Dialect } from '../../../rules/types.js'
import { keyName, unwrap } from './parse.js'
import type { Scope } from './scope.js'

/** TypeORM driver types (DataSourceOptions.type) that behave like each lint dialect. */
const DRIVERS: Readonly<Record<Dialect, readonly string[]>> = {
  postgres: ['postgres', 'aurora-postgres'],
  mysql: ['mysql', 'mariadb', 'aurora-mysql'],
}

/** Every TypeORM driver type, for reading enum members such as DatabaseTypeEnum.betterSqlite3. */
const KNOWN_DRIVERS = [
  'postgres',
  'aurora-postgres',
  'cockroachdb',
  'mysql',
  'mariadb',
  'aurora-mysql',
  'sqlite',
  'better-sqlite3',
  'sqljs',
  'capacitor',
  'cordova',
  'react-native',
  'nativescript',
  'expo',
  'mssql',
  'oracle',
  'sap',
  'spanner',
  'mongodb',
]

const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')
const DRIVER_BY_NORMALIZED = new Map(KNOWN_DRIVERS.map((d) => [normalize(d), d]))

/**
 * True when `node` reads the database type the migration runs against:
 * `queryRunner.connection.options.type` or `queryRunner.dataSource.options.type` (optionally
 * through `.driver`), or a constant holding one of those.
 */
export function isDatabaseType(node: t.Node, scope: Scope, depth = 0): boolean {
  const n = unwrap(node)
  if (n.type === 'Identifier') {
    const binding = scope.lookup(n.name)
    return (
      depth < 8 &&
      binding?.kind === 'const' &&
      binding.init !== null &&
      isDatabaseType(binding.init, binding.scope, depth + 1)
    )
  }
  const path: string[] = []
  let current: t.Node = n
  while (current.type === 'MemberExpression' || current.type === 'OptionalMemberExpression') {
    const name = keyName(current.property, current.computed)
    if (name === undefined) return false
    path.unshift(name)
    current = unwrap(current.object)
  }
  if (current.type !== 'Identifier' || scope.lookup(current.name)?.kind !== 'queryRunner')
    return false
  // TypeORM 1.x renamed QueryRunner.connection to dataSource and kept connection as an alias.
  const [owner, ...rest] = path
  const tail = rest.join('.')
  return (
    (owner === 'connection' || owner === 'dataSource') &&
    (tail === 'options.type' || tail === 'driver.options.type')
  )
}

/**
 * The driver type a value names: a string literal, a constant, or an enum member whose name
 * matches a TypeORM driver type exactly (ignoring case and punctuation), such as
 * `DatabaseTypeEnum.postgres`. Returns undefined when it cannot be known.
 */
export function driverName(node: t.Node, scope: Scope, depth = 0): string | undefined {
  const n = unwrap(node)
  switch (n.type) {
    case 'StringLiteral':
      return n.value
    case 'TemplateLiteral':
      return n.expressions.length === 0 ? (n.quasis[0]?.value.cooked ?? undefined) : undefined
    case 'Identifier': {
      const binding = scope.lookup(n.name)
      if (depth >= 8 || binding?.kind !== 'const' || binding.init === null) return undefined
      return driverName(binding.init, binding.scope, depth + 1)
    }
    case 'MemberExpression': {
      const member = keyName(n.property, n.computed)
      return member === undefined ? undefined : DRIVER_BY_NORMALIZED.get(normalize(member))
    }
    default:
      return undefined
  }
}

const matches = (driver: string, dialect: Dialect) => DRIVERS[dialect].includes(driver)

/**
 * Evaluates a condition that depends only on the database type. Returns undefined when the
 * condition depends on anything else.
 */
export function evaluateCondition(
  node: t.Node,
  scope: Scope,
  dialect: Dialect,
  depth = 0,
): boolean | undefined {
  const n = unwrap(node)
  switch (n.type) {
    case 'Identifier': {
      // const isPostgres = queryRunner.connection.options.type === 'postgres'
      const binding = scope.lookup(n.name)
      if (depth >= 8 || binding?.kind !== 'const' || binding.init === null) return undefined
      return evaluateCondition(binding.init, binding.scope, dialect, depth + 1)
    }
    case 'BinaryExpression': {
      if (!['===', '==', '!==', '!='].includes(n.operator)) return undefined
      const left = n.left as t.Node
      const other = isDatabaseType(left, scope)
        ? n.right
        : isDatabaseType(n.right, scope)
          ? left
          : undefined
      const driver = other === undefined ? undefined : driverName(other, scope)
      if (driver === undefined) return undefined
      const equal = matches(driver, dialect)
      return n.operator.startsWith('!') ? !equal : equal
    }
    case 'UnaryExpression': {
      if (n.operator !== '!') return undefined
      const inner = evaluateCondition(n.argument, scope, dialect)
      return inner === undefined ? undefined : !inner
    }
    case 'LogicalExpression': {
      const left = evaluateCondition(n.left, scope, dialect)
      const right = evaluateCondition(n.right, scope, dialect)
      if (n.operator === '&&') {
        if (left === false || right === false) return false
        return left === true && right === true ? true : undefined
      }
      if (n.operator === '||') {
        if (left === true || right === true) return true
        return left === false && right === false ? false : undefined
      }
      return undefined
    }
    case 'CallExpression': {
      // ['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)
      const callee = unwrap(n.callee)
      const [arg] = n.arguments
      if (
        callee.type !== 'MemberExpression' ||
        keyName(callee.property, callee.computed) !== 'includes' ||
        arg === undefined ||
        arg.type === 'SpreadElement' ||
        arg.type === 'ArgumentPlaceholder' ||
        !isDatabaseType(arg, scope)
      ) {
        return undefined
      }
      const list = unwrap(callee.object)
      if (list.type !== 'ArrayExpression') return undefined
      const drivers = list.elements.map((e) =>
        e === null || e.type === 'SpreadElement' ? undefined : driverName(e, scope),
      )
      if (drivers.some((d) => d === undefined)) return undefined
      return drivers.some((d) => d !== undefined && matches(d, dialect))
    }
    default:
      return undefined
  }
}

/**
 * For a `switch` on the database type, the statements that run for the dialect: from the
 * matching case (or default) up to the first `break`, following fall-through. Returns
 * undefined when the switch is not on the database type or a case cannot be resolved.
 */
export function switchBranch(
  node: t.SwitchStatement,
  scope: Scope,
  dialect: Dialect,
): t.Statement[] | undefined {
  if (!isDatabaseType(node.discriminant, scope)) return undefined
  let start = -1
  let fallback = -1
  for (const [i, c] of node.cases.entries()) {
    if (c.test == null) {
      fallback = i
      continue
    }
    const driver = driverName(c.test, scope)
    if (driver === undefined) return undefined
    if (start < 0 && matches(driver, dialect)) start = i
  }
  if (start < 0) start = fallback
  const run: t.Statement[] = []
  if (start < 0) return run
  for (const c of node.cases.slice(start)) {
    for (const statement of c.consequent) {
      if (statement.type === 'BreakStatement' && !statement.label) return run
      run.push(statement)
    }
  }
  return run
}
