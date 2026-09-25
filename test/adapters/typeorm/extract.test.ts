import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { extractTypeorm } from '../../../src/adapters/typeorm/index.js'
import { LineIndex } from '../../../src/adapters/typeorm/extract/lines.js'
import { locateSql } from '../../../src/ir/locate.js'
import type { Dialect } from '../../../src/rules/types.js'

const root = fileURLToPath(new URL('./fixtures/', import.meta.url))

/** Every fixture, as a POSIX path relative to the fixtures folder. */
const fixtures = readdirSync(root, { recursive: true, encoding: 'utf8' })
  .map((f) => f.split(path.sep).join('/'))
  .filter((f) => /\.(ts|js|mjs|cjs)$/.test(f))
  .sort()

/** Optional first line: `// fixture: {"dialect":"mysql","transactionMode":"each"}` */
function fixtureOptions(text: string): { dialect: Dialect; options: Record<string, unknown> } {
  const match = /^\/\/ fixture: (\{.*\})/.exec(text)
  const { dialect = 'postgres', ...options } = (
    match ? JSON.parse(match[1] ?? '{}') : {}
  ) as Record<string, unknown> & { dialect?: Dialect }
  return { dialect, options }
}

function extract(fixture: string) {
  const text = readFileSync(path.join(root, fixture), 'utf8')
  return { text, result: extractTypeorm({ path: fixture, text }, fixtureOptions(text)) }
}

describe('TypeORM static extraction', () => {
  it('has at least 30 fixtures', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(30)
  })

  it.each(fixtures)('%s', async (fixture) => {
    const { result } = extract(fixture)
    await expect(`${JSON.stringify(result, null, 2)}\n`).toMatchFileSnapshot(
      path.join(root, `${fixture}.expected.json`),
    )
  })

  it.each(fixtures)('%s: every SQL character maps back to where it is written', (fixture) => {
    const { text, result } = extract(fixture)
    const lines = new LineIndex(text)
    for (const migration of result) {
      for (const step of migration.up) {
        if (step.kind !== 'sql') continue
        for (let i = 0; i < step.sql.length; i++) {
          const loc = locateSql(step.map, i)
          const written = text.charAt(lines.offset(loc.line, loc.column))
          // An escaped character maps to the backslash that starts its escape sequence,
          // and a line break normalized from CRLF maps to the carriage return.
          if (written !== step.sql.charAt(i)) expect(['\\', '\r']).toContain(written)
        }
      }
    }
  })
})
