import { parse } from '@babel/parser'
import type * as t from '@babel/types'
import { describe, expect, it } from 'vitest'
import { evaluateCondition, switchBranch } from '../../../src/adapters/typeorm/extract/dialect.js'
import { Scope } from '../../../src/adapters/typeorm/extract/scope.js'

function scope(): Scope {
  const s = new Scope()
  s.declare('qr', { kind: 'queryRunner' })
  return s
}

function expression(code: string): t.Expression {
  const [statement] = parse(`(${code})`, { plugins: ['typescript'] }).program.body
  if (statement?.type !== 'ExpressionStatement') throw new Error('not an expression')
  return statement.expression
}

describe('evaluateCondition', () => {
  it.each([
    ["qr.connection.options.type === 'postgres'", true],
    ["'postgres' === qr.dataSource.options.type", true],
    ["qr.connection.driver.options.type == 'aurora-postgres'", true],
    ["qr.connection.options.type !== 'postgres'", false],
    ["qr.connection.options.type != 'mysql'", true],
    ['qr.connection.options.type === DatabaseTypeEnum.postgres', true],
    ['qr.connection.options.type === Db.BetterSqlite3', false],
    ["!(qr.connection.options.type === 'sqlite')", true],
    ["qr.connection.options.type === 'postgres' && qr.connection.options.type !== 'mysql'", true],
    ["qr.connection.options.type === 'mysql' || qr.connection.options.type === 'mariadb'", false],
    ["qr.connection.options.type === 'mysql' && other", false],
    ["qr.connection.options.type === 'postgres' || other", true],
    ["['postgres', 'cockroachdb'].includes(qr.connection.options.type)", true],
    ["['sqlite', 'better-sqlite3'].includes(qr.connection.options.type)", false],
  ])('%s is %s on postgres', (code, expected) => {
    expect(evaluateCondition(expression(code), scope(), 'postgres')).toBe(expected)
  })

  it.each([
    'qr.connection.options.type === other',
    'qr.connection.options.type === Db.somethingCustom',
    "qr.connection.options.type < 'postgres'",
    "qr.connection.type === 'postgres'",
    "qr.connection.options['type' + x] === 'postgres'",
    "other.connection.options.type === 'postgres'",
    "qr.connection.options.type === 'postgres' && other",
    "qr.connection.options.type === 'mysql' || other",
    "qr.connection.options.type === 'postgres' ?? other",
    "['postgres', other].includes(qr.connection.options.type)",
    '[...list].includes(qr.connection.options.type)',
    'list.includes(qr.connection.options.type)',
    "['postgres'].includes(other)",
    "['postgres'].indexOf(qr.connection.options.type)",
    '-qr.connection.options.type',
    'flag',
  ])('%s cannot be known', (code) => {
    expect(evaluateCondition(expression(code), scope(), 'postgres')).toBeUndefined()
  })

  it('reads the type from a constant alias and a template literal', () => {
    const s = scope()
    const program = parse('const dbType = qr.connection.options.type; const pg = `postgres`', {
      plugins: ['typescript'],
    }).program
    s.declareStatements(program.body)
    expect(evaluateCondition(expression('dbType === pg'), s, 'postgres')).toBe(true)
    expect(evaluateCondition(expression('dbType === pg'), s, 'mysql')).toBe(false)
  })

  it('reads a condition stored in a constant', () => {
    const s = scope()
    const program = parse("const isPostgres = qr.connection.options.type === 'postgres'", {
      plugins: ['typescript'],
    }).program
    s.declareStatements(program.body)
    expect(evaluateCondition(expression('isPostgres'), s, 'postgres')).toBe(true)
    expect(evaluateCondition(expression('!isPostgres'), s, 'mysql')).toBe(true)
  })
})

describe('switchBranch', () => {
  function run(code: string, dialect: 'postgres' | 'mysql') {
    const [statement] = parse(code, { plugins: ['typescript'] }).program.body
    if (statement?.type !== 'SwitchStatement') throw new Error('not a switch')
    return switchBranch(statement, scope(), dialect)?.map((s) => s.type)
  }

  it('returns nothing when no case matches and there is no default', () => {
    expect(run("switch (qr.connection.options.type) { case 'sqlite': f() }", 'postgres')).toEqual(
      [],
    )
  })

  it('is undefined for a switch on something else', () => {
    expect(run("switch (x) { case 'postgres': f() }", 'postgres')).toBeUndefined()
  })
})
