import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * House style for every file in the repository: no em dashes and no en dashes. Write plain
 * sentences instead (see CONTRIBUTING.md). Only files that are not text are skipped.
 */
const root = fileURLToPath(new URL('../../', import.meta.url))
const DASHES = /[–—]/
const BINARY = /\.(png|jpe?g|gif|ico|tgz|gz|zip|wasm|woff2?)$/i

const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter((f) => f !== '' && !BINARY.test(f))

describe('house style', () => {
  it('finds the tracked files', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('has no em or en dashes in any tracked file', () => {
    const hits: string[] = []
    for (const file of files) {
      let text: string
      try {
        text = readFileSync(`${root}${file}`, 'utf8')
      } catch {
        continue // Deleted in the working tree but not yet staged.
      }
      text.split('\n').forEach((line, i) => {
        if (DASHES.test(line)) hits.push(`${file}:${String(i + 1)}`)
      })
    }
    expect(hits).toEqual([])
  })
})
