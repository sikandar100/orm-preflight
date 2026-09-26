import { docsUrl } from './helpers.js'
import type { Rule } from './types.js'

export const noEditAppliedMigration: Rule = {
  meta: {
    id: 'no-edit-applied-migration',
    category: 'correctness',
    // Spec default: error. New rules ship at warn in a minor release (CONTRIBUTING).
    defaultSeverity: 'warn',
    dialects: ['postgres', 'mysql'],
    docsUrl: docsUrl('no-edit-applied-migration'),
  },
  check(migration, ctx) {
    // Only --changed-since knows which migrations already exist on the base branch.
    if (ctx.changes?.files.get(migration.file) !== 'modified') return []
    return [
      {
        loc: migration.loc,
        message: `This migration already exists on ${ctx.changes.ref} and was changed. It has probably run in some environments already, and the change will never reach them.`,
        why: 'An ORM records each migration it runs and never runs it again, so an edit to an applied migration only reaches new databases. Environments that already ran it drift apart silently.',
        safeAlternative:
          'Undo the edit and put the change in a new migration. If this migration has never run anywhere, for example because it was only on your branch, suppress this finding with a reason.',
      },
    ]
  },
}
