import { beforeAll, describe, expect, it } from 'vitest'
import type { OperationBody } from '../../src/ir/types.js'
import { canFailWhenNull } from '../../src/rules/check-nulls.js'
import { loadPostgresParser, type SqlParser } from '../../src/sql/postgres/parse.js'

let parse: SqlParser

beforeAll(async () => {
  parse = await loadPostgresParser()
})

/** The CHECK expression of `ALTER TABLE t ADD CHECK (<expr>)`. */
function check(expr: string) {
  const result = parse(`ALTER TABLE t ADD CONSTRAINT c CHECK (${expr})`)
  if (!result.ok) throw new Error(result.message)
  const op = result.statements[0]?.ops[0] as Extract<OperationBody, { kind: 'add_constraint' }>
  if (op.check === undefined) throw new Error('no check expression')
  return op.check
}

/**
 * A CHECK constraint passes when its expression is true or NULL. With the new column `n` NULL
 * in every row, these can never be false, so adding them can never fail.
 */
describe('a CHECK that cannot fail while the new column is NULL', () => {
  it.each([
    'n > 0',
    'n >= start_date',
    'n IS NULL OR n >= start_date',
    'n IN (1, 2, 3)',
    'n BETWEEN 1 AND 10',
    "n LIKE 'a%'",
    'n::int > 0',
    'char_length(n) > 0',
    "lower(n) = 'x'",
    'n >= start_date AND n - start_date <= 30',
    'NOT (n < 0)',
    'n = ANY (ARRAY[1, 2])',
  ])('%s', (expr) => {
    expect(canFailWhenNull(check(expr), new Set(['n']))).toBe(false)
  })
})

describe('a CHECK that can fail, or might', () => {
  it.each([
    // Requires the new column, which is NULL in every row.
    'n IS NOT NULL',
    'is_tentative OR (n IS NOT NULL AND n >= start_date)',
    // Uses only existing columns, about which nothing is known.
    'start_date > 0',
    // Not analyzed: nothing is assumed.
    'coalesce(n, 0) > 0',
    'n IS DISTINCT FROM 0',
    'CASE WHEN n IS NULL THEN false ELSE true END',
    'some_function(n) > 0',
  ])('%s', (expr) => {
    expect(canFailWhenNull(check(expr), new Set(['n']))).toBe(true)
  })

  it('only assumes NULL for the columns it is told about', () => {
    expect(canFailWhenNull(check('n > 0'), new Set(['other']))).toBe(true)
  })
})
