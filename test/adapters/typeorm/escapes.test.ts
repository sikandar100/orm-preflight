import { describe, expect, it } from 'vitest'
import { decodeEscapes } from '../../../src/adapters/typeorm/extract/escapes.js'
import { LineIndex } from '../../../src/adapters/typeorm/extract/lines.js'

describe('decodeEscapes', () => {
  it.each([
    ['plain text', 'abc', false, 'abc', [0, 1, 2]],
    ['simple escapes', String.raw`a\nb\tc`, false, 'a\nb\tc', [0, 1, 3, 4, 6]],
    ['quotes and backslash', String.raw`\'\"\\`, false, `'"\\`, [0, 2, 4]],
    ['template escapes', String.raw`\`x\${y}`, true, '`x${y}', [0, 2, 3, 5, 6, 7]],
    ['hex escape', String.raw`\x41B`, false, 'AB', [0, 4]],
    ['unicode escape', String.raw`\u0041B`, false, 'AB', [0, 6]],
    ['code point escape', String.raw`\u{1F600}!`, false, '\u{1F600}!', [0, 0, 9]],
    ['null escape', String.raw`a\0b`, false, 'a\0b', [0, 1, 3]],
    ['identity escape', String.raw`\q`, false, 'q', [0]],
    ['line continuation LF', 'a\\\nb', true, 'ab', [0, 3]],
    ['line continuation CRLF', 'a\\\r\nb', true, 'ab', [0, 4]],
    ['template CRLF becomes LF', 'a\r\nb', true, 'a\nb', [0, 1, 3]],
    ['template lone CR becomes LF', 'a\rb', true, 'a\nb', [0, 1, 2]],
    ['astral characters stay two code units', 'x\u{1F600}', false, 'x\u{1F600}', [0, 1, 2]],
  ])('%s', (_, raw, template, cooked, source) => {
    expect(decodeEscapes(raw, template)).toEqual({ cooked, source })
  })

  it.each([
    ['legacy octal', String.raw`\1`],
    ['octal-looking null', String.raw`\01`],
    ['\\8', String.raw`\8`],
    ['bad hex', String.raw`\xZZ`],
    ['bad unicode', String.raw`\u12`],
    ['unterminated code point', String.raw`\u{12`],
    ['code point out of range', String.raw`\u{110000}`],
    ['trailing backslash', 'abc\\'],
  ])('returns null for %s', (_, raw) => {
    expect(decodeEscapes(raw, true)).toBeNull()
  })
})

describe('LineIndex', () => {
  it('maps offsets to 1-based lines and columns across line break styles', () => {
    const index = new LineIndex('ab\ncd\r\nef\rgh\u2028ij')
    expect(index.position(0)).toEqual({ line: 1, column: 1 })
    expect(index.position(1)).toEqual({ line: 1, column: 2 })
    expect(index.position(3)).toEqual({ line: 2, column: 1 })
    expect(index.position(7)).toEqual({ line: 3, column: 1 })
    expect(index.position(10)).toEqual({ line: 4, column: 1 })
    expect(index.position(13)).toEqual({ line: 5, column: 1 })
    expect(index.position(14)).toEqual({ line: 5, column: 2 })
  })
})

describe('LineIndex.offset', () => {
  it('is the inverse of position', () => {
    const text = 'ab\ncd\r\nef\rgh'
    const index = new LineIndex(text)
    for (let offset = 0; offset < text.length; offset++) {
      const { line, column } = index.position(offset)
      expect(index.offset(line, column)).toBe(offset)
    }
  })
})
