/**
 * Functions whose value changes on every call. A column default that calls one of them
 * must be evaluated per row, so ADD COLUMN rewrites the whole table.
 * `now()` and `CURRENT_TIMESTAMP` are stable within a statement, so they are not listed.
 * `nextval` also covers `serial` and `bigserial` columns.
 */
export const VOLATILE_FUNCTIONS: readonly string[] = [
  'random',
  'gen_random_uuid',
  'uuid_generate_v1',
  'uuid_generate_v4',
  'clock_timestamp',
  'timeofday',
  'nextval',
]

const volatileCall = new RegExp(`(?:^|[^\\w$"])"?(?:${VOLATILE_FUNCTIONS.join('|')})"?\\s*\\(`, 'i')

/** True when a default expression calls a volatile function outside a string literal. */
export function isVolatileDefault(expr: string): boolean {
  // Remove string literals first, so text such as 'random()' is not mistaken for a call.
  const withoutStrings = expr.replace(/'(?:[^']|'')*'/g, "''")
  return volatileCall.test(withoutStrings)
}
