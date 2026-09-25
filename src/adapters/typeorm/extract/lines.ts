/** Converts file offsets to 1-based lines and columns, using the same line breaks as Babel. */
export class LineIndex {
  private readonly starts: number[] = [0]

  constructor(text: string) {
    for (let i = 0; i < text.length; i++) {
      const c = text[i]
      if (c === '\r') {
        if (text[i + 1] === '\n') i++
        this.starts.push(i + 1)
      } else if (c === '\n' || c === '\u2028' || c === '\u2029') {
        this.starts.push(i + 1)
      }
    }
  }

  /** The file offset of a 1-based line and column. */
  offset(line: number, column: number): number {
    return (this.starts[line - 1] ?? Number.NaN) + column - 1
  }

  position(offset: number): { line: number; column: number } {
    let low = 0
    let high = this.starts.length - 1
    while (low < high) {
      const mid = (low + high + 1) >> 1
      if ((this.starts[mid] ?? 0) <= offset) low = mid
      else high = mid - 1
    }
    return { line: low + 1, column: offset - (this.starts[low] ?? 0) + 1 }
  }
}
