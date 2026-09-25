import { closest } from '../config/validate.js'
import { docsUrl } from './helpers.js'
import type { Rule, RuleFinding } from './types.js'

export const invalidSuppression: Rule = {
  meta: {
    id: 'invalid-suppression',
    category: 'correctness',
    defaultSeverity: 'error',
    dialects: ['postgres', 'mysql'],
    docsUrl: docsUrl('invalid-suppression'),
  },
  check(migration, ctx) {
    const findings: RuleFinding[] = []
    for (const s of migration.suppressions) {
      let message: string | undefined
      if (s.ruleId === '') message = 'This suppression comment names no rule.'
      else if (!ctx.knownRuleIds.has(s.ruleId)) {
        const suggestion = closest(s.ruleId, [...ctx.knownRuleIds])
        message = `This suppression names "${s.ruleId}", which is not a known rule.${suggestion === undefined ? '' : ` Did you mean "${suggestion}"?`}`
      } else if (s.reason === '') message = `This suppression of "${s.ruleId}" gives no reason.`
      if (message === undefined) continue
      findings.push({
        loc: s.loc,
        message,
        why: 'Every suppression needs a known rule and a reason, so suppressions form an audit trail. An invalid suppression suppresses nothing.',
        safeAlternative: 'Write it as: // preflight safety-assured <rule-id> -- <reason>',
      })
    }
    return findings
  },
}
