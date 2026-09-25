import { describe, expect, it } from 'vitest'
import { parseSuppressionComment } from '../../src/engine/suppression-comments.js'

describe('parseSuppressionComment', () => {
  it.each([
    [
      ' preflight safety-assured no-drop-column -- removed from the entity in 2.3',
      { scope: 'next', ruleId: 'no-drop-column', reason: 'removed from the entity in 2.3' },
    ],
    [
      ' preflight safety-assured typeorm/no-enum-recreate -- values only added',
      { scope: 'next', ruleId: 'typeorm/no-enum-recreate', reason: 'values only added' },
    ],
    [
      ' preflight safety-assured-file no-truncate -- test data only ',
      { scope: 'file', ruleId: 'no-truncate', reason: 'test data only' },
    ],
    [
      '*\n * preflight safety-assured no-drop-table -- archived\n ',
      { scope: 'next', ruleId: 'no-drop-table', reason: 'archived' },
    ],
    [
      ' preflight safety-assured no-drop-table --   ',
      { scope: 'next', ruleId: 'no-drop-table', reason: '' },
    ],
    [
      ' preflight safety-assured no-drop-table',
      { scope: 'next', ruleId: 'no-drop-table', reason: '' },
    ],
    [
      ' preflight safety-assured -- no rule named',
      { scope: 'next', ruleId: '', reason: 'no rule named' },
    ],
    [' preflight safety-assured', { scope: 'next', ruleId: '', reason: '' }],
    [
      ' preflight safety-assured a -- reason -- with -- dashes',
      { scope: 'next', ruleId: 'a', reason: 'reason -- with -- dashes' },
    ],
  ])('%j', (text, expected) => {
    expect(parseSuppressionComment(text)).toEqual(expected)
  })

  it.each([
    ' eslint-disable-next-line',
    ' preflight is great',
    ' preflight safety-assuredly',
    ' this mentions preflight safety-assured later',
    '',
  ])('ignores %j', (text) => {
    expect(parseSuppressionComment(text)).toBeUndefined()
  })
})
