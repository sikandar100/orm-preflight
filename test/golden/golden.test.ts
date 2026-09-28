import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { typeormAdapter } from '../../src/adapters/typeorm/index.js'
import { resolveConfig } from '../../src/config/load.js'
import { lintSources } from '../../src/lint.js'

/**
 * Golden suite (SPEC 8.3). Every migration in this folder was written by real
 * `typeorm migration:generate` (scripts/golden/generate.sh). Each must trigger exactly the
 * rules in expected.json: a missing rule is a false negative, an extra one a false positive.
 */
interface Expected {
  knownGaps: Record<string, string>
  [version: string]: Record<string, Record<string, string[]>> | Record<string, string>
}

const expected = JSON.parse(
  readFileSync(new URL('./expected.json', import.meta.url), 'utf8'),
) as Expected

const versions = readdirSync(new URL('./', import.meta.url)).filter((d) => d.startsWith('typeorm-'))
const cases = versions.flatMap((version) =>
  (['postgres', 'mysql'] as const).flatMap((dialect) =>
    readdirSync(new URL(`./${version}/${dialect}/`, import.meta.url))
      .filter((f) => f.endsWith('.ts'))
      .map((file) => ({ version, dialect, file, scenario: file.replace(/^\d+-|\.ts$/g, '') })),
  ),
)

describe('golden migrations from real TypeORM', () => {
  it('covers the 11 scenarios on two TypeORM lines and two databases', () => {
    expect(cases).toHaveLength(44)
  })

  it.each(cases)('$version $dialect $scenario', async ({ version, dialect, file, scenario }) => {
    const text = readFileSync(new URL(`./${version}/${dialect}/${file}`, import.meta.url), 'utf8')
    const config = resolveConfig({ dialect }, 'golden')
    const result = await lintSources([{ path: file, text }], config, typeormAdapter)
    const rules = [...new Set(result.findings.map((f) => f.ruleId))].sort()
    const byDialect = expected[version] as Record<string, Record<string, string[]>> | undefined
    expect(rules).toEqual(byDialect?.[dialect]?.[scenario])
  })
})
