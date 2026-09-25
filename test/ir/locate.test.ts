import { describe, expect, it } from 'vitest'
import { locateSql } from '../../src/ir/locate.js'
import type { SqlSourceMap } from '../../src/ir/types.js'

const map: SqlSourceMap = {
  file: 'm.ts',
  runs: [
    { offset: 0, line: 3, column: 10 },
    { offset: 5, line: 4, column: 1 },
    { offset: 9, line: 4, column: 20 },
  ],
}

describe('locateSql', () => {
  it.each([
    [0, 3, 10],
    [4, 3, 14],
    [5, 4, 1],
    [8, 4, 4],
    [9, 4, 20],
    [12, 4, 23],
  ])('maps offset %i to line %i, column %i', (offset, line, column) => {
    expect(locateSql(map, offset)).toEqual({ file: 'm.ts', line, column })
  })

  it('clamps negative offsets to the first character', () => {
    expect(locateSql(map, -3)).toEqual({ file: 'm.ts', line: 3, column: 10 })
  })

  it('throws on an empty map', () => {
    expect(() => locateSql({ file: 'm.ts', runs: [] }, 0)).toThrow('no runs')
  })
})
