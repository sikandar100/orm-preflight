import { docsUrl, opsOf } from './helpers.js'
import type { Rule } from './types.js'

export const unanalyzableStatement: Rule = {
  meta: {
    id: 'unanalyzable-statement',
    category: 'correctness',
    defaultSeverity: 'warn',
    dialects: ['postgres', 'mysql'],
    docsUrl: docsUrl('unanalyzable-statement'),
  },
  check(migration) {
    return opsOf(migration.up, 'unanalyzable').map((op) => ({
      op,
      message: `This statement could not be analyzed: ${op.reason}.`,
      why: 'orm-preflight never passes what it could not read. The statement may contain any of the hazards the other rules check.',
      safeAlternative:
        'Write the SQL as a constant string or a builder call orm-preflight can read, or check the statement by hand and suppress this finding with a reason.',
    }))
  },
}
