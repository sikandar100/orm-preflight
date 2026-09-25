import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { allRules } from '../../src/cli/commands.js'
import { ruleDocs } from '../../src/cli/rule-docs.js'

describe('embedded rule docs', () => {
  it('has exactly one entry per rule', () => {
    expect(Object.keys(ruleDocs).sort()).toEqual(
      allRules()
        .map((r) => r.meta.id)
        .sort(),
    )
  })

  it.each(Object.entries(ruleDocs))('embeds docs/rules/%s.md unchanged', (id, text) => {
    expect(text).toBe(readFileSync(new URL(`../../docs/rules/${id}.md`, import.meta.url), 'utf8'))
  })
})
