import { docsUrl } from './helpers.js'
import type { Rule } from './types.js'

export const requireDown: Rule = {
  meta: {
    id: 'require-down',
    category: 'correctness',
    defaultSeverity: 'warn',
    dialects: ['postgres', 'mysql'],
    docsUrl: docsUrl('require-down'),
  },
  check(migration) {
    if (!migration.downIsEmpty) return []
    return [
      {
        loc: migration.loc,
        message:
          'This migration has an empty or missing down(), so reverting it changes nothing in the database but still marks it as not applied.',
        why: 'Reverting runs down() and then deletes the migration from the migrations table. With an empty down(), the schema keeps every change, and the next run applies up() again to a schema that already has them, which usually fails.',
        safeAlternative:
          'Write the reverse of up() in down(). If the change cannot be undone, for example because it deletes data, throw an error in down() that says so, so a revert stops instead of silently doing nothing.',
      },
    ]
  },
}
