import { describe, expect, it } from 'vitest'
import { sarifRules } from '../../src/cli/commands.js'
import { formatSarif } from '../../src/reporters/sarif.js'
import { result } from './result.js'
import { validateSarif as validate } from './sarif-schema.js'

interface Sarif {
  runs: {
    tool: { driver: { rules: { id: string; shortDescription: { text: string } }[] } }
    results: {
      ruleId: string
      ruleIndex: number
      level: string
      suppressions?: unknown[]
      locations: { physicalLocation: { artifactLocation: { uri: string } } }[]
    }[]
  }[]
}

describe('formatSarif', () => {
  const output = formatSarif(result, { rules: sarifRules(), pathPrefix: '' })
  const sarif = JSON.parse(output) as Sarif

  it('is valid SARIF 2.1.0', () => {
    expect(validate(sarif), JSON.stringify(validate.errors, null, 2)).toBe(true)
  })

  it('describes every rule with the summary from its docs', () => {
    const rules = sarif.runs[0]?.tool.driver.rules ?? []
    expect(rules.map((r) => r.id)).toEqual(sarifRules().map((r) => r.id))
    for (const rule of rules) expect(rule.shortDescription.text).toMatch(/^[A-Z`].+\.$/)
  })

  it('links each result to its rule and keeps suppressions with the reason', () => {
    const [error, warning, suppressed] = sarif.runs[0]?.results ?? []
    const rules = sarif.runs[0]?.tool.driver.rules ?? []
    expect(rules[error?.ruleIndex ?? -1]?.id).toBe('no-drop-column')
    expect(error?.level).toBe('error')
    expect(warning?.level).toBe('warning')
    expect(error?.suppressions).toBeUndefined()
    expect(suppressed?.suppressions).toEqual([
      { kind: 'inSource', justification: 'unused since 2.3' },
    ])
  })

  it('prefixes paths with the directory inside the repository', () => {
    const prefixed = JSON.parse(
      formatSarif(result, { rules: sarifRules(), pathPrefix: 'api' }),
    ) as Sarif
    expect(prefixed.runs[0]?.results[0]?.locations[0]?.physicalLocation.artifactLocation.uri).toBe(
      'api/src/migrations/1727600000000-DropBio.ts',
    )
  })

  it('matches the snapshot', async () => {
    await expect(output).toMatchFileSnapshot('./__snapshots__/sarif.json')
  })
})
