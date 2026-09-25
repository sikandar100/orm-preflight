import { describe, expect, it } from 'vitest'
import { codePointToIndex, Utf8Offsets } from '../../src/sql/offsets.js'

// Built from code points so no editor or tool can rewrite the characters.
const e = String.fromCodePoint(0xe9) // 2 bytes in UTF-8, 1 UTF-16 unit
const snowman = String.fromCodePoint(0x2603) // 3 bytes, 1 unit
const grin = String.fromCodePoint(0x1f600) // 4 bytes, 2 units

describe('Utf8Offsets', () => {
  it('maps byte offsets to string indexes', () => {
    const text = `a${e}b${snowman}c${grin}d`
    const offsets = new Utf8Offsets(text)
    // a=0 | é=1..2 | b=3 | ☃=4..6 | c=7 | 😀=8..11 | d=12 | end=13
    const cases: [number, number][] = [
      [0, 0],
      [1, 1],
      [3, 2],
      [4, 3],
      [7, 4],
      [8, 5],
      [12, 7],
      [13, 8],
    ]
    for (const [byte, index] of cases) expect(offsets.toIndex(byte)).toBe(index)
  })

  it('is exact for ASCII', () => {
    const offsets = new Utf8Offsets('ALTER TABLE t')
    expect(offsets.toIndex(6)).toBe(6)
  })

  it('clamps offsets past the end', () => {
    expect(new Utf8Offsets(`x${e}`).toIndex(99)).toBe(2)
  })

  it('maps an offset inside a character to that character', () => {
    expect(new Utf8Offsets(`x${snowman}y`).toIndex(2)).toBe(1)
  })
})

describe('codePointToIndex', () => {
  it('accounts for astral characters taking two UTF-16 units', () => {
    const text = `${grin}ab${grin}c`
    expect(codePointToIndex(text, 0)).toBe(0)
    expect(codePointToIndex(text, 1)).toBe(2)
    expect(codePointToIndex(text, 3)).toBe(4)
    expect(codePointToIndex(text, 4)).toBe(6)
    expect(codePointToIndex(text, 9)).toBe(text.length)
  })
})
