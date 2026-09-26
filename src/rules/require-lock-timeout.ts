import type { Operation, TableRef } from '../ir/types.js'
import { docsUrl, table, tableKey } from './helpers.js'
import type { Rule } from './types.js'

/** The table an operation locks, for operations that wait for a lock on an existing table. */
function lockedTable(op: Operation): TableRef | undefined {
  switch (op.kind) {
    case 'add_column':
    case 'drop_column':
    case 'rename_column':
    case 'alter_column_type':
    case 'set_not_null':
    case 'add_constraint':
    case 'validate_constraint':
    case 'drop_constraint':
    case 'rename_table':
    case 'drop_table':
      return op.table
    case 'create_index':
      return op.concurrently ? undefined : op.table
    case 'truncate':
    case 'lock_table':
      return op.tables[0]
    default:
      return undefined
  }
}

export const requireLockTimeout: Rule = {
  meta: {
    id: 'require-lock-timeout',
    category: 'locking',
    defaultSeverity: 'off',
    dialects: ['postgres'],
    docsUrl: docsUrl('require-lock-timeout'),
  },
  check(migration, ctx) {
    const created = new Set<string>()
    for (const op of migration.up) {
      if (op.kind === 'set_setting' && op.name === 'lock_timeout' && !/^'?0\w*'?$/.test(op.value)) {
        return []
      }
      if (op.kind === 'create_table') created.add(tableKey(op.table))
      const locked = lockedTable(op)
      if (locked === undefined || created.has(tableKey(locked))) continue
      // One finding per migration, at the first statement that waits for a lock.
      return [
        {
          op,
          target: { table: locked },
          message: `This migration changes ${table(locked, ctx)} without a lock_timeout. If ${table(locked, ctx)} is busy, the change waits for its lock, and every query on ${table(locked, ctx)} queues behind it.`,
          why: 'A schema change first waits for every running query on the table to finish, and while it waits, it blocks all new queries on that table. One slow query can turn a quick change into an outage.',
          safeAlternative:
            "Start up() with SET LOCAL lock_timeout = '5s' when the migration runs in a transaction, or SET lock_timeout = '5s' when it does not. The change then fails fast instead of queuing traffic, and you can retry it.",
        },
      ]
    }
    return []
  },
}
