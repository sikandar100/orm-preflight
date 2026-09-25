import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { typeormAdapter } from '../../src/adapters/typeorm/index.js'
import { typeormRules } from '../../src/adapters/typeorm/rules/index.js'
import { resolveConfig } from '../../src/config/load.js'
import { lintSources } from '../../src/lint.js'
import { coreRules } from '../../src/rules/index.js'

/**
 * Every rule has a doc in the format of SPEC section 7, and the doc's examples are real: each
 * migration under "Bad" must produce the rule's finding, and each one under a "Safe" heading
 * must not. A Safe section's JSON block is the config for its examples, and a PostgreSQL
 * version in its heading ("Safe on PostgreSQL 18") sets postgresVersion.
 */
const docsDir = fileURLToPath(new URL('../../docs/rules/', import.meta.url))
const rules = [...coreRules, ...typeormRules]
const DATABASES = { postgres: 'PostgreSQL', mysql: 'MySQL' } as const

interface Section {
  heading: string
  body: string
}

function sections(markdown: string): Section[] {
  return markdown
    .split(/^## /m)
    .slice(1)
    .map((part) => {
      const newline = part.indexOf('\n')
      return { heading: part.slice(0, newline).trim(), body: part.slice(newline + 1) }
    })
}

function codeBlocks(body: string, lang: string): string[] {
  const fence = new RegExp('^```' + lang + '\\n([\\s\\S]*?)^```', 'gm')
  return [...body.matchAll(fence)].map((m) => m[1] ?? '')
}

function migrations(body: string): string[] {
  return codeBlocks(body, 'ts').filter((code) => code.includes('implements MigrationInterface'))
}

async function unsuppressed(ruleId: string, code: string, raw: Record<string, unknown>) {
  const config = resolveConfig(raw, 'doc example')
  const result = await lintSources([{ path: 'example.ts', text: code }], config, typeormAdapter)
  return result.findings.filter((f) => f.ruleId === ruleId && f.suppressed === null)
}

describe.each(rules.map((r) => ({ id: r.meta.id, rule: r })))(
  'docs/rules/$id.md',
  ({ id, rule }) => {
    const file = `${docsDir}${id}.md`
    const text = existsSync(file) ? readFileSync(file, 'utf8') : ''
    const parts = sections(text)

    it('exists and matches the rule', () => {
      expect(text).not.toBe('')
      expect(text.startsWith(`# ${id}\n`)).toBe(true)
      const databases = rule.meta.dialects.map((d) => DATABASES[d]).join(', ')
      const lines = text.split('\n')
      const header = lines.findIndex((l) => l.startsWith('| Category'))
      const cells = (lines[header + 2] ?? '').split('|').map((c) => c.trim())
      expect(cells.slice(1, 4)).toEqual([rule.meta.category, rule.meta.defaultSeverity, databases])
      expect(rule.meta.docsUrl.endsWith(`/docs/rules/${id}.md`)).toBe(true)
    })

    it('has every section, in order, in plain English', () => {
      const headings = parts.map((s) => s.heading.replace(/^Safe on .*/, 'Safe'))
      expect([...new Set(headings)]).toEqual([
        'What happens',
        'Bad',
        'Safe',
        'When to suppress',
        'References',
      ])
      expect(text).not.toMatch(/[\u2013\u2014]/)
    })

    it('has a Bad example that the rule reports', async () => {
      const bad = parts.filter((s) => s.heading === 'Bad').flatMap((s) => migrations(s.body))
      expect(bad.length).toBeGreaterThan(0)
      for (const code of bad) expect(await unsuppressed(id, code, {})).not.toEqual([])
    })

    it('has Safe examples that the rule does not report', async () => {
      for (const section of parts.filter((s) => s.heading.startsWith('Safe'))) {
        const json = codeBlocks(section.body, 'json')[0]
        const config = (json === undefined ? {} : JSON.parse(json)) as Record<string, unknown>
        const version = /PostgreSQL (\d+)$/.exec(section.heading)?.[1]
        if (version !== undefined) config.postgresVersion = Number(version)
        for (const code of migrations(section.body))
          expect(await unsuppressed(id, code, config)).toEqual([])
      }
    })
  },
)
