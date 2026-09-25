import { describe, expect, it } from 'vitest'
import { adapters, createRegistry, getAdapter } from '../../src/adapters/index.js'
import type { OrmAdapter } from '../../src/adapters/types.js'
import type { Rule } from '../../src/rules/types.js'

function rule(id: string, adapter?: string): Rule {
  return {
    meta: {
      id,
      category: 'correctness',
      defaultSeverity: 'warn',
      dialects: ['postgres'],
      docsUrl: 'https://example.com',
      ...(adapter === undefined ? {} : { adapter }),
    },
    check: () => [],
  }
}

function adapter(id: string, rules: Rule[] = []): OrmAdapter {
  return {
    id,
    defaultMigrationGlobs: [],
    configSchema: {},
    extract: () => [],
    rules,
  }
}

describe('createRegistry', () => {
  it('accepts adapter rules prefixed with the adapter ID', () => {
    const registry = createRegistry([adapter('fake', [rule('fake/no-thing', 'fake')])])
    expect(registry.get('fake')?.id).toBe('fake')
  })

  it.each([
    ['no prefix', rule('no-thing', 'fake')],
    ['another adapter prefix', rule('other/no-thing', 'fake')],
    ['prefix only', rule('fake/', 'fake')],
    ['missing meta.adapter', rule('fake/no-thing')],
    ['wrong meta.adapter', rule('fake/no-thing', 'other')],
  ])('throws for a rule with %s', (_, badRule) => {
    expect(() => createRegistry([adapter('fake', [badRule])])).toThrow(/fake/)
  })

  it('throws for duplicate adapter IDs', () => {
    expect(() => createRegistry([adapter('fake'), adapter('fake')])).toThrow(
      'Duplicate adapter ID "fake"',
    )
  })

  it('throws for an invalid adapter ID', () => {
    expect(() => createRegistry([adapter('Bad/Id')])).toThrow('Invalid adapter ID "Bad/Id"')
  })
})

describe('built-in registry', () => {
  it('contains the typeorm adapter', () => {
    expect(adapters.map((a) => a.id)).toEqual(['typeorm'])
    expect(getAdapter('typeorm')?.id).toBe('typeorm')
  })

  it('returns undefined for an unknown adapter', () => {
    expect(getAdapter('prisma')).toBeUndefined()
  })
})
