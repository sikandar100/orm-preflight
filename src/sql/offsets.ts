/**
 * PostgreSQL reports statement positions in UTF-8 bytes, while JavaScript strings are
 * indexed in UTF-16 code units. This converts between the two.
 */
export class Utf8Offsets {
  /** For each UTF-8 byte offset, the UTF-16 index of the character that contains it. */
  private readonly indexByByte: number[] = []

  constructor(private readonly text: string) {
    let index = 0
    for (const char of text) {
      const bytes = Buffer.byteLength(char, 'utf8')
      for (let b = 0; b < bytes; b++) this.indexByByte.push(index)
      index += char.length
    }
  }

  toIndex(byteOffset: number): number {
    return this.indexByByte[byteOffset] ?? this.text.length
  }
}

/** PostgreSQL error cursor positions count characters (code points), not UTF-16 units. */
export function codePointToIndex(text: string, codePoints: number): number {
  let index = 0
  let count = 0
  for (const char of text) {
    if (count === codePoints) return index
    index += char.length
    count++
  }
  return text.length
}
