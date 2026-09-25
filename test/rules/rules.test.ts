import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { typeormAdapter } from '../../src/adapters/typeorm/index.js'
import { resolveConfig } from '../../src/config/load.js'
import { lintSources } from '../../src/lint.js'

/**
 * Rule fixtures (SPEC 8.2): test/rules/<rule-id>/bad/*.ts must produce that rule's finding,
 * test/rules/<rule-id>/good/*.ts must not. Every fixture's complete findings are kept in a
 * reviewed snapshot next to it. An optional first line sets the config:
 * `// fixture: {"dialect":"mysql","rules":{...}}`
 */
const root = fileURLToPath(new URL('./', import.meta.url))

const cases = readdirSync(root)
  .filter((ruleId) => statSync(path.join(root, ruleId)).isDirectory())
  .flatMap((ruleId) =>
    (['bad', 'good'] as const).flatMap((kind) => {
      const dir = path.join(root, ruleId, kind)
      const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.ts')) : []
      return files.sort().map((file) => ({ ruleId, kind, file: `${ruleId}/${kind}/${file}` }))
    }),
  )

async function findingsFor(file: string) {
  const text = readFileSync(path.join(root, file), 'utf8')
  const header = /^\/\/ fixture: (\{.*\})/.exec(text)?.[1]
  const config = resolveConfig(
    header === undefined ? {} : (JSON.parse(header) as unknown),
    'fixture',
  )
  const result = await lintSources([{ path: file, text }], config, typeormAdapter)
  return result.findings
}

describe('rule fixtures', () => {
  it('every rule directory has bad and good fixtures', () => {
    for (const ruleId of new Set(cases.map((c) => c.ruleId))) {
      const kinds = new Set(cases.filter((c) => c.ruleId === ruleId).map((c) => c.kind))
      expect([ruleId, [...kinds].sort()]).toEqual([ruleId, ['bad', 'good']])
    }
  })

  it.each(cases)('$file', async ({ ruleId, kind, file }) => {
    const findings = await findingsFor(file)
    const own = findings.filter((f) => f.ruleId === ruleId)
    if (kind === 'bad') expect(own.length).toBeGreaterThan(0)
    else expect(own).toEqual([])
    await expect(`${JSON.stringify(findings, null, 2)}\n`).toMatchFileSnapshot(
      path.join(root, `${file}.findings.json`),
    )
  })
})
