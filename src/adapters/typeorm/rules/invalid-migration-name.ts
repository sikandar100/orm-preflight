import { docsUrl } from '../../../rules/helpers.js'
import type { Rule } from '../../../rules/types.js'

export const invalidMigrationName: Rule = {
  meta: {
    id: 'typeorm/invalid-migration-name',
    category: 'correctness',
    defaultSeverity: 'error',
    dialects: ['postgres', 'mysql'],
    adapter: 'typeorm',
    docsUrl: docsUrl('typeorm/invalid-migration-name'),
  },
  check(migration) {
    const data = migration.adapterData ?? {}
    // Unparseable files are reported by unanalyzable-statement, and a non-constant name
    // gets an unanalyzable-statement warning from the extractor instead.
    if (migration.timestamp !== null || data.parseError === true || data.name === null) return []
    const name = typeof data.name === 'string' ? data.name : data.className
    const subject =
      typeof name === 'string'
        ? `"${name}" does not`
        : 'This migration class has no name, so it does not'
    return [
      {
        loc: migration.loc,
        message: `${subject} end with a 13-digit timestamp. TypeORM refuses to load it ("migration name is wrong") and no pending migration runs.`,
        why: "TypeORM reads a migration's timestamp from the last 13 characters of its name property, or of the class name when name is not set, and throws when they are not a number.",
        safeAlternative:
          'Name the class, or set name, so it ends with the timestamp, for example AddUsersEmail1727200000000. typeorm migration:generate and migration:create do this for you.',
      },
    ]
  },
}
