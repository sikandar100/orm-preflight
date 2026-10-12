import type { CheckExpr } from '../ir/types.js'

type Truth = 'true' | 'false' | 'null'
type Nullness = 'null' | 'maybe' | 'not-null'

/**
 * Whether a CHECK expression can be false when the given columns are NULL in every row.
 * SQL uses three-valued logic: a CHECK constraint passes when its expression is true or NULL,
 * and fails only when it is false. Anything not modeled counts as possibly false.
 */
export function canFailWhenNull(expr: CheckExpr, nullColumns: ReadonlySet<string>): boolean {
  return truth(expr, nullColumns).has('false')
}

/** The truth values the expression can have. */
function truth(e: CheckExpr, nulls: ReadonlySet<string>): ReadonlySet<Truth> {
  switch (e.kind) {
    case 'and':
      return e.args.reduce<ReadonlySet<Truth>>(
        (acc, arg) => combine(acc, truth(arg, nulls), and3),
        new Set(['true']),
      )
    case 'or':
      return e.args.reduce<ReadonlySet<Truth>>(
        (acc, arg) => combine(acc, truth(arg, nulls), or3),
        new Set(['false']),
      )
    case 'not':
      return new Set([...truth(e.arg, nulls)].map(not3))
    case 'is_null':
    case 'is_not_null': {
      const n = nullness(e.arg, nulls)
      const isNull: ReadonlySet<Truth> =
        n === 'null' ? new Set(['true']) : n === 'not-null' ? new Set(['false']) : ALL_BUT_NULL
      return e.kind === 'is_null' ? isNull : new Set([...isNull].map(not3))
    }
    default: {
      const n = nullness(e, nulls)
      return n === 'null' ? new Set(['null']) : n === 'not-null' ? ALL_BUT_NULL : ALL
    }
  }
}

/** Whether the expression's value is NULL, never NULL, or either. */
function nullness(e: CheckExpr, nulls: ReadonlySet<string>): Nullness {
  switch (e.kind) {
    case 'column':
      return nulls.has(e.name) ? 'null' : 'maybe'
    case 'null':
      return 'null'
    case 'value':
      return 'not-null'
    case 'strict':
      return e.args.some((a) => nullness(a, nulls) === 'null') ? 'null' : 'maybe'
    case 'other':
      return 'maybe'
    default: {
      const t = truth(e, nulls)
      if (t.size === 1 && t.has('null')) return 'null'
      return t.has('null') ? 'maybe' : 'not-null'
    }
  }
}

const ALL: ReadonlySet<Truth> = new Set(['true', 'false', 'null'])
const ALL_BUT_NULL: ReadonlySet<Truth> = new Set(['true', 'false'])

function combine(
  a: ReadonlySet<Truth>,
  b: ReadonlySet<Truth>,
  op: (x: Truth, y: Truth) => Truth,
): ReadonlySet<Truth> {
  const out = new Set<Truth>()
  for (const x of a) for (const y of b) out.add(op(x, y))
  return out
}

function and3(x: Truth, y: Truth): Truth {
  if (x === 'false' || y === 'false') return 'false'
  if (x === 'null' || y === 'null') return 'null'
  return 'true'
}

function or3(x: Truth, y: Truth): Truth {
  if (x === 'true' || y === 'true') return 'true'
  if (x === 'null' || y === 'null') return 'null'
  return 'false'
}

function not3(x: Truth): Truth {
  return x === 'true' ? 'false' : x === 'false' ? 'true' : 'null'
}
