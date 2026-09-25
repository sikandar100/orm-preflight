import { describe, expect, it } from 'vitest'
import { normalizeOperation } from '../../src/ir/normalize.js'
import { normalizeMysqlType, normalizePostgresType } from '../../src/sql/type-names.js'

describe('normalizePostgresType', () => {
  it.each([
    ['int', 'int4'],
    ['INTEGER', 'int4'],
    ['bigint', 'int8'],
    ['character varying(255)', 'varchar(255)'],
    ['varchar( 255 )', 'varchar(255)'],
    ['pg_catalog.varchar', 'varchar'],
    ['timestamp with time zone', 'timestamptz'],
    ['timestamp  without  time zone', 'timestamp'],
    ['double precision', 'float8'],
    ['numeric(10, 2)[]', 'numeric(10,2)[]'],
    ['text[][]', 'text[][]'],
    ['int[3]', 'int4[]'],
    ['uuid', 'uuid'],
    ['"public"."users_status_enum"', 'public.users_status_enum'],
    ['boolean', 'bool'],
    ['bigserial', 'int8'],
  ])('%s becomes %s', (input, expected) => {
    expect(normalizePostgresType(input)).toBe(expected)
  })
})

describe('normalizeMysqlType', () => {
  it.each([
    ['VARCHAR(255)', 'varchar(255)'],
    ['DECIMAL( 10 , 2 ) UNSIGNED', 'decimal(10,2) unsigned'],
    ["ENUM('a', 'b')", "enum('a','b')"],
  ])('%s becomes %s', (input, expected) => {
    expect(normalizeMysqlType(input)).toBe(expected)
  })
})

describe('normalizeOperation', () => {
  it('fills the default schema and keeps an explicit one', () => {
    const op = normalizeOperation(
      {
        kind: 'add_constraint',
        table: { name: 'posts' },
        type: 'foreign_key',
        notValid: false,
        references: { schema: 'app', name: 'users' },
      },
      { dialect: 'postgres', defaultSchema: 'public' },
    )
    expect(op).toEqual({
      kind: 'add_constraint',
      table: { schema: 'public', name: 'posts' },
      type: 'foreign_key',
      notValid: false,
      references: { schema: 'app', name: 'users' },
    })
  })

  it('leaves tables alone when there is no default schema', () => {
    const op = normalizeOperation(
      { kind: 'truncate', tables: [{ name: 'a' }] },
      { dialect: 'mysql' },
    )
    expect(op).toEqual({ kind: 'truncate', tables: [{ name: 'a' }] })
  })

  it('normalizes column types', () => {
    expect(
      normalizeOperation(
        { kind: 'alter_column_type', table: { name: 't' }, column: 'c', to: 'INT', using: false },
        { dialect: 'mysql' },
      ),
    ).toMatchObject({ to: 'int' })
  })
})
