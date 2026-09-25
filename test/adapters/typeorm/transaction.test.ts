import { describe, expect, it } from 'vitest'
import {
  resolveTransactionMode,
  runsInTransaction,
} from '../../../src/adapters/typeorm/transaction.js'

describe('runsInTransaction', () => {
  it.each([
    // mode "all": one transaction around every pending migration
    ['all', undefined, true],
    ['all', true, true],
    ['all', false, true], // TypeORM throws instead; typeorm/transaction-override-forbidden reports it
    ['all', 'unknown', true],
    // mode "each": a transaction per migration unless it opts out
    ['each', undefined, true],
    ['each', true, true],
    ['each', false, false],
    ['each', 'unknown', 'unknown'],
    // mode "none": no transaction unless the migration opts in
    ['none', undefined, false],
    ['none', true, true],
    ['none', false, false],
    ['none', 'unknown', 'unknown'],
  ] as const)(
    'mode %s with transaction=%s runs in a transaction: %s',
    (mode, declared, expected) => {
      expect(runsInTransaction(mode, declared)).toBe(expected)
    },
  )
})

describe('resolveTransactionMode', () => {
  it('defaults to "all", like TypeORM', () => {
    expect(resolveTransactionMode({})).toBe('all')
  })

  it.each(['all', 'each', 'none'])('reads %s from the adapter options', (mode) => {
    expect(resolveTransactionMode({ transactionMode: mode })).toBe(mode)
  })

  it('throws on an invalid value that skipped config validation', () => {
    expect(() => resolveTransactionMode({ transactionMode: 'sometimes' })).toThrow(
      'transactionMode',
    )
  })
})
