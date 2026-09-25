/**
 * Canonical PostgreSQL type names, so the same type written differently compares equal:
 * TypeORM's `int` and SQL's `integer` both become `int4`.
 */
const POSTGRES_ALIASES: Readonly<Record<string, string>> = {
  int: 'int4',
  integer: 'int4',
  int4: 'int4',
  smallint: 'int2',
  int2: 'int2',
  bigint: 'int8',
  int8: 'int8',
  serial: 'int4',
  serial4: 'int4',
  smallserial: 'int2',
  serial2: 'int2',
  bigserial: 'int8',
  serial8: 'int8',
  real: 'float4',
  float4: 'float4',
  float: 'float8',
  'double precision': 'float8',
  float8: 'float8',
  decimal: 'numeric',
  numeric: 'numeric',
  boolean: 'bool',
  bool: 'bool',
  'character varying': 'varchar',
  varchar: 'varchar',
  character: 'bpchar',
  char: 'bpchar',
  bpchar: 'bpchar',
  timestamp: 'timestamp',
  'timestamp without time zone': 'timestamp',
  timestamptz: 'timestamptz',
  'timestamp with time zone': 'timestamptz',
  time: 'time',
  'time without time zone': 'time',
  timetz: 'timetz',
  'time with time zone': 'timetz',
}

/** Serial types add a sequence default: `nextval(...)`, which is volatile. */
export const SERIAL_TYPES: ReadonlySet<string> = new Set([
  'serial',
  'serial4',
  'smallserial',
  'serial2',
  'bigserial',
  'serial8',
])

/** Canonical name of a base PostgreSQL type, without modifiers or array brackets. */
export function canonicalPostgresType(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/^pg_catalog\./, '')
    .replace(/\s+/g, ' ')
  return POSTGRES_ALIASES[cleaned] ?? cleaned
}

/**
 * Normalizes a full type string such as `character varying(255)[]` to `varchar(255)[]`.
 * Qualified user types (`"public"."status_enum"`) keep their schema and lose their quotes.
 */
export function normalizePostgresType(type: string): string {
  const match = /^(.*?)\s*(\(\s*[^)]*\))?\s*((?:\[\s*\d*\s*\])*)$/.exec(type.trim())
  if (!match) return type
  const [, base = '', mods = '', arrays = ''] = match
  const name = base.includes('"') ? base.replace(/"/g, '') : canonicalPostgresType(base)
  const modifiers = mods.replace(/\s+/g, '')
  const dims = (arrays.match(/\[/g) ?? []).length
  return `${name}${modifiers}${'[]'.repeat(dims)}`
}

/** MySQL type names are case-insensitive; lowercase them and remove spaces in modifiers. */
export function normalizeMysqlType(type: string): string {
  return type
    .trim()
    .toLowerCase()
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*\)/g, ')')
}
