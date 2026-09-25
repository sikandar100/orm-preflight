import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LineIndex } from '../../src/adapters/typeorm/extract/lines.js'
import { extractTypeorm } from '../../src/adapters/typeorm/index.js'
import { parseMigrations } from '../../src/sql/index.js'
import type { Dialect } from '../../src/rules/types.js'

const root = fileURLToPath(new URL('../adapters/typeorm/fixtures/', import.meta.url))

const fixtures = readdirSync(root, { recursive: true, encoding: 'utf8' })
  .map((f) => f.split(path.sep).join('/'))
  .filter((f) => /\.(ts|js|mjs|cjs)$/.test(f))
  .sort()

function options(
  fixture: string,
  text: string,
): { dialect: Dialect; options: Record<string, unknown> } {
  const match = /^\/\/ fixture: (\{.*\})/.exec(text)
  const fromPath: Dialect = fixture.includes('/mysql-') ? 'mysql' : 'postgres'
  const { dialect = fromPath, ...rest } = (match ? JSON.parse(match[1] ?? '{}') : {}) as Record<
    string,
    unknown
  > & { dialect?: Dialect }
  return { dialect, options: rest }
}

async function analyze(fixture: string) {
  const text = readFileSync(path.join(root, fixture), 'utf8')
  const ctx = options(fixture, text)
  const extracted = extractTypeorm({ path: fixture, text }, ctx)
  return { text, analyzed: await parseMigrations(extracted, { dialect: ctx.dialect }) }
}

describe('extraction and SQL parsing, end to end', () => {
  it.each(fixtures)('%s', async (fixture) => {
    const { analyzed } = await analyze(fixture)
    await expect(`${JSON.stringify(analyzed, null, 2)}\n`).toMatchFileSnapshot(
      path.join(root, `${fixture}.analyzed.json`),
    )
  })

  it.each(fixtures)(
    '%s: every SQL operation points at its statement in the file',
    async (fixture) => {
      const { text, analyzed } = await analyze(fixture)
      const lines = new LineIndex(text)
      for (const migration of analyzed) {
        for (const op of migration.up) {
          if (op.origin !== 'sql' || op.sql === undefined || op.kind === 'unanalyzable') continue
          const at = text.charAt(lines.offset(op.loc.line, op.loc.column))
          // The first character of the statement, or the backslash of an escape for it.
          if (at !== op.sql.charAt(0)) expect(at).toBe('\\')
        }
      }
    },
  )
})
