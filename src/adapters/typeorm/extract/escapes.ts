const SIMPLE: Readonly<Record<string, string>> = {
  n: '\n',
  t: '\t',
  r: '\r',
  b: '\b',
  f: '\f',
  v: '\v',
}

const HEX = /^[0-9a-fA-F]+$/

export interface Decoded {
  /** The string value, as JavaScript sees it at runtime. */
  cooked: string
  /** For each UTF-16 code unit of `cooked`, the index in the raw text it came from. */
  source: number[]
}

/**
 * Decodes the raw source text of a string or template literal body (without quotes or
 * backticks). Returns null for escapes that are invalid in strict-mode code.
 */
export function decodeEscapes(raw: string, template: boolean): Decoded | null {
  let cooked = ''
  const source: number[] = []
  const emit = (text: string, from: number) => {
    cooked += text
    // One entry per UTF-16 code unit, so astral characters get two.
    source.push(...new Array<number>(text.length).fill(from))
  }

  let i = 0
  while (i < raw.length) {
    const c = raw.charAt(i)
    if (c === '\r' && template) {
      // Template literals normalize CRLF and CR line breaks to LF.
      emit('\n', i)
      i += raw[i + 1] === '\n' ? 2 : 1
      continue
    }
    if (c !== '\\') {
      emit(c, i)
      i++
      continue
    }

    const n = raw[i + 1]
    if (n === undefined) return null
    const simple = SIMPLE[n]
    if (simple !== undefined) {
      emit(simple, i)
      i += 2
    } else if (n === '0' && !/[0-9]/.test(raw[i + 2] ?? '')) {
      emit('\0', i)
      i += 2
    } else if (/[0-9]/.test(n)) {
      return null // legacy octal escapes and \8 \9 are errors in strict mode
    } else if (n === 'x') {
      const hex = raw.slice(i + 2, i + 4)
      if (hex.length !== 2 || !HEX.test(hex)) return null
      emit(String.fromCharCode(parseInt(hex, 16)), i)
      i += 4
    } else if (n === 'u') {
      let hex: string
      let length: number
      if (raw[i + 2] === '{') {
        const end = raw.indexOf('}', i + 3)
        if (end === -1) return null
        hex = raw.slice(i + 3, end)
        length = end + 1 - i
      } else {
        hex = raw.slice(i + 2, i + 6)
        length = 6
        if (hex.length !== 4) return null
      }
      const code = HEX.test(hex) ? parseInt(hex, 16) : NaN
      if (Number.isNaN(code) || code > 0x10ffff) return null
      emit(String.fromCodePoint(code), i)
      i += length
    } else if (n === '\r') {
      i += raw[i + 2] === '\n' ? 3 : 2 // line continuation
    } else if (n === '\n' || n === '\u2028' || n === '\u2029') {
      i += 2 // line continuation
    } else {
      emit(n, i) // \' \" \\ \` \$ and other identity escapes
      i += 2
    }
  }
  return { cooked, source }
}
