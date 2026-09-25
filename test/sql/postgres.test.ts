import { beforeAll, describe, expect, it } from 'vitest'
import type { OperationBody } from '../../src/ir/types.js'
import { loadPostgresParser, type SqlParser } from '../../src/sql/postgres/parse.js'

let parse: SqlParser

beforeAll(async () => {
  parse = await loadPostgresParser()
})

/** Operations of every statement, without positions. */
function ops(sql: string): OperationBody[] {
  const result = parse(sql)
  if (!result.ok) throw new Error(`parse failed: ${result.message}`)
  return result.statements.flatMap((s) => s.ops)
}

const users = { name: 'users' }

describe('PostgreSQL statements to operations', () => {
  it.each<[string, OperationBody[]]>([
    ['CREATE TABLE "t" ("id" int PRIMARY KEY)', [{ kind: 'create_table', table: { name: 't' } }]],
    ['CREATE TABLE t2 AS SELECT 1', [{ kind: 'create_table', table: { name: 't2' } }]],
    [
      'DROP TABLE "a", "s"."b"',
      [
        { kind: 'drop_table', table: { name: 'a' } },
        { kind: 'drop_table', table: { schema: 's', name: 'b' } },
      ],
    ],
    [
      'ALTER TABLE "users" RENAME TO "accounts"',
      [{ kind: 'rename_table', table: users, to: 'accounts' }],
    ],
    [
      'ALTER TABLE "users" ADD "bio" text',
      [{ kind: 'add_column', table: users, column: 'bio', type: 'text', notNull: false }],
    ],
    [
      'ALTER TABLE "users" ADD COLUMN "name" character varying(255) NOT NULL DEFAULT \'x\'',
      [
        {
          kind: 'add_column',
          table: users,
          column: 'name',
          type: 'varchar(255)',
          notNull: true,
          default: { expr: "'x'", volatile: false },
        },
      ],
    ],
    [
      'ALTER TABLE users ADD token uuid NOT NULL DEFAULT gen_random_uuid()',
      [
        {
          kind: 'add_column',
          table: users,
          column: 'token',
          type: 'uuid',
          notNull: true,
          default: { expr: 'gen_random_uuid()', volatile: true },
        },
      ],
    ],
    [
      'ALTER TABLE users ADD created timestamp with time zone DEFAULT now(), ADD n numeric(10,2)[]',
      [
        {
          kind: 'add_column',
          table: users,
          column: 'created',
          type: 'timestamptz',
          notNull: false,
          default: { expr: 'now()', volatile: false },
        },
        { kind: 'add_column', table: users, column: 'n', type: 'numeric(10,2)[]', notNull: false },
      ],
    ],
    [
      'ALTER TABLE users ADD score int DEFAULT (random() * 10)::int NOT NULL',
      [
        {
          kind: 'add_column',
          table: users,
          column: 'score',
          type: 'int4',
          notNull: true,
          default: { expr: '(random() * 10)::int', volatile: true },
        },
      ],
    ],
    [
      'ALTER TABLE users ADD seq bigserial',
      [
        {
          kind: 'add_column',
          table: users,
          column: 'seq',
          type: 'int8',
          notNull: true,
          default: { expr: 'nextval (serial)', volatile: true },
        },
      ],
    ],
    [
      'ALTER TABLE users ADD num int GENERATED ALWAYS AS IDENTITY, ADD twice int GENERATED ALWAYS AS (num * 2) STORED',
      [
        {
          kind: 'add_column',
          table: users,
          column: 'num',
          type: 'int4',
          notNull: true,
          generated: 'identity',
        },
        {
          kind: 'add_column',
          table: users,
          column: 'twice',
          type: 'int4',
          notNull: false,
          generated: 'stored',
        },
      ],
    ],
    [
      'ALTER TABLE "public"."users" ADD "status" "public"."users_status_enum" NOT NULL',
      [
        {
          kind: 'add_column',
          table: { schema: 'public', name: 'users' },
          column: 'status',
          type: 'public.users_status_enum',
          notNull: true,
        },
      ],
    ],
    [
      'ALTER TABLE "users" DROP COLUMN "name"',
      [{ kind: 'drop_column', table: users, column: 'name' }],
    ],
    [
      'ALTER TABLE "users" RENAME COLUMN "age" TO "years"',
      [{ kind: 'rename_column', table: users, column: 'age', to: 'years' }],
    ],
    [
      'ALTER TABLE users ALTER COLUMN name TYPE varchar(500)',
      [
        {
          kind: 'alter_column_type',
          table: users,
          column: 'name',
          to: 'varchar(500)',
          toTypmods: [500],
          using: false,
        },
      ],
    ],
    [
      'ALTER TABLE "users" ALTER COLUMN "status" TYPE "public"."e" USING "status"::"text"::"public"."e"',
      [{ kind: 'alter_column_type', table: users, column: 'status', to: 'public.e', using: true }],
    ],
    [
      'ALTER TABLE users ALTER COLUMN name SET NOT NULL',
      [{ kind: 'set_not_null', table: users, column: 'name' }],
    ],
    [
      'ALTER TABLE "posts" ADD CONSTRAINT "FK_1" FOREIGN KEY ("author") REFERENCES "users"("id")',
      [
        {
          kind: 'add_constraint',
          table: { name: 'posts' },
          name: 'FK_1',
          type: 'foreign_key',
          notValid: false,
          references: users,
        },
      ],
    ],
    [
      'ALTER TABLE posts ADD FOREIGN KEY (a) REFERENCES s.users (id) NOT VALID',
      [
        {
          kind: 'add_constraint',
          table: { name: 'posts' },
          type: 'foreign_key',
          notValid: true,
          references: { schema: 's', name: 'users' },
        },
      ],
    ],
    [
      'ALTER TABLE users ADD CONSTRAINT c CHECK (age > 0) NOT VALID, ADD CONSTRAINT u UNIQUE USING INDEX idx, ADD PRIMARY KEY (id)',
      [
        { kind: 'add_constraint', table: users, name: 'c', type: 'check', notValid: true },
        {
          kind: 'add_constraint',
          table: users,
          name: 'u',
          type: 'unique',
          notValid: false,
          usingIndex: 'idx',
        },
        { kind: 'add_constraint', table: users, type: 'primary_key', notValid: false },
      ],
    ],
    [
      'ALTER TABLE users VALIDATE CONSTRAINT c',
      [{ kind: 'validate_constraint', table: users, name: 'c' }],
    ],
    [
      'ALTER TABLE users DROP CONSTRAINT "c"',
      [{ kind: 'drop_constraint', table: users, name: 'c' }],
    ],
    [
      'CREATE UNIQUE INDEX CONCURRENTLY "IDX_a" ON "users" ("email")',
      [{ kind: 'create_index', table: users, name: 'IDX_a', unique: true, concurrently: true }],
    ],
    [
      'CREATE INDEX ON users (email)',
      [{ kind: 'create_index', table: users, unique: false, concurrently: false }],
    ],
    [
      'DROP INDEX CONCURRENTLY IF EXISTS "public"."IDX_a", "IDX_b"',
      [
        { kind: 'drop_index', name: 'public.IDX_a', concurrently: true },
        { kind: 'drop_index', name: 'IDX_b', concurrently: true },
      ],
    ],
    [
      'TRUNCATE "a", s.b CASCADE',
      [{ kind: 'truncate', tables: [{ name: 'a' }, { schema: 's', name: 'b' }] }],
    ],
    [
      'ALTER TYPE "public"."e" RENAME TO "e_old"',
      [{ kind: 'enum_rename', from: 'public.e', to: 'e_old' }],
    ],
    ['CREATE TYPE "public"."e" AS ENUM(\'a\', \'b\')', [{ kind: 'enum_create', name: 'public.e' }]],
    [
      'DROP TYPE "public"."e_old", other',
      [
        { kind: 'enum_drop', name: 'public.e_old' },
        { kind: 'enum_drop', name: 'other' },
      ],
    ],
    ["ALTER TYPE e ADD VALUE 'banned'", [{ kind: 'enum_add_value', name: 'e', value: 'banned' }]],
    ["SET lock_timeout = '5s'", [{ kind: 'set_setting', name: 'lock_timeout', value: '5s' }]],
    [
      'SET LOCAL statement_timeout TO 0',
      [{ kind: 'set_setting', name: 'statement_timeout', value: '0' }],
    ],
    ['VACUUM FULL users', [{ kind: 'maintenance', command: 'vacuum_full', concurrently: false }]],
    ['CLUSTER users USING idx', [{ kind: 'maintenance', command: 'cluster', concurrently: false }]],
    [
      'REINDEX INDEX CONCURRENTLY idx',
      [{ kind: 'maintenance', command: 'reindex', concurrently: true }],
    ],
    ['REINDEX TABLE users', [{ kind: 'maintenance', command: 'reindex', concurrently: false }]],
    ['BEGIN', [{ kind: 'transaction_control', action: 'start' }]],
    ['START TRANSACTION', [{ kind: 'transaction_control', action: 'start' }]],
    ['COMMIT', [{ kind: 'transaction_control', action: 'commit' }]],
    ['ROLLBACK', [{ kind: 'transaction_control', action: 'rollback' }]],
    [
      'LOCK TABLE users, s.t IN SHARE MODE',
      [{ kind: 'lock_table', tables: [users, { schema: 's', name: 't' }], mode: 'SHARE' }],
    ],
    ['LOCK users', [{ kind: 'lock_table', tables: [users], mode: 'ACCESS EXCLUSIVE' }]],
    ['UPDATE users SET a = 1', [{ kind: 'data_change', table: users, statement: 'update' }]],
    [
      'INSERT INTO s.users (a) SELECT 1',
      [{ kind: 'data_change', table: { schema: 's', name: 'users' }, statement: 'insert' }],
    ],
    ['DELETE FROM users WHERE a = 1', [{ kind: 'data_change', table: users, statement: 'delete' }]],
    [
      'MERGE INTO users u USING src s ON u.id = s.id WHEN MATCHED THEN UPDATE SET a = s.a',
      [{ kind: 'data_change', table: users, statement: 'merge' }],
    ],
    [
      'ALTER TABLE posts ADD author int REFERENCES users (id), ADD code text UNIQUE, ADD n int CHECK (n > 0)',
      [
        {
          kind: 'add_column',
          table: { name: 'posts' },
          column: 'author',
          type: 'int4',
          notNull: false,
        },
        {
          kind: 'add_constraint',
          table: { name: 'posts' },
          type: 'foreign_key',
          notValid: false,
          references: users,
        },
        {
          kind: 'add_column',
          table: { name: 'posts' },
          column: 'code',
          type: 'text',
          notNull: false,
        },
        { kind: 'add_constraint', table: { name: 'posts' }, type: 'unique', notValid: false },
        { kind: 'add_column', table: { name: 'posts' }, column: 'n', type: 'int4', notNull: false },
        { kind: 'add_constraint', table: { name: 'posts' }, type: 'check', notValid: false },
      ],
    ],
    [
      'ALTER TABLE t ADD id bigint PRIMARY KEY',
      [
        { kind: 'add_column', table: { name: 't' }, column: 'id', type: 'int8', notNull: true },
        { kind: 'add_constraint', table: { name: 't' }, type: 'primary_key', notValid: false },
      ],
    ],
    ['SET enable_seqscan = off', [{ kind: 'set_setting', name: 'enable_seqscan', value: 'off' }]],
    [
      'SET random_page_cost = 1.5',
      [{ kind: 'set_setting', name: 'random_page_cost', value: '1.5' }],
    ],
    ['SET x.flag = true', [{ kind: 'set_setting', name: 'x.flag', value: 'true' }]],
  ])('%s', (sql, expected) => {
    expect(ops(sql)).toEqual(expected)
  })

  it.each([
    'SELECT 1',
    "COMMENT ON TABLE users IS 'x'",
    'GRANT SELECT ON users TO app',
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
    'CREATE SEQUENCE s',
    'ALTER SEQUENCE s RESTART',
    'CREATE VIEW v AS SELECT 1',
    'CREATE TRIGGER trg AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION f()',
    'DROP VIEW v',
    'DROP SEQUENCE s',
    'DROP TRIGGER trg ON users',
    'DROP FUNCTION f()',
    'DROP EXTENSION x',
    'CREATE SCHEMA s',
    'ALTER TABLE users ALTER COLUMN a SET DEFAULT 1',
    'ALTER TABLE users ALTER COLUMN a DROP DEFAULT',
    'ALTER TABLE users ALTER COLUMN a DROP NOT NULL',
    'ALTER TABLE users ALTER COLUMN a SET STORAGE EXTERNAL',
    'ALTER INDEX i RENAME TO j',
    'ALTER TABLE users RENAME CONSTRAINT a TO b',
    "ALTER TYPE e RENAME VALUE 'a' TO 'b'",
    'VACUUM users',
    'ANALYZE users',
    'RESET lock_timeout',
    'SAVEPOINT s',
    'ALTER INDEX i SET (fillfactor = 70)',
    'ALTER VIEW v OWNER TO app',
    'CREATE MATERIALIZED VIEW mv AS SELECT 1',
  ])('%s produces no operation', (sql) => {
    expect(ops(sql)).toEqual([])
  })

  it.each([
    ["DO $$ BEGIN RAISE NOTICE 'x'; END $$", 'DO blocks'],
    ['CREATE FUNCTION f() RETURNS int AS $$ SELECT 1 $$ LANGUAGE sql', 'Function bodies'],
    ['CREATE OR REPLACE PROCEDURE p() LANGUAGE sql AS $$ SELECT 1 $$', 'Function bodies'],
    ['ALTER TABLE users ADD CONSTRAINT ex EXCLUDE USING gist (a WITH =)', 'EXCLUDE'],
    ['CREATE POLICY p ON users USING (true)', 'CreatePolicyStmt'],
    ['ALTER TABLE users SET TABLESPACE fast', 'AT_SetTableSpace'],
    ['DROP COLLATION c', 'OBJECT_COLLATION'],
    ['ALTER TABLE users ADD CONSTRAINT ex EXCLUDE USING gist (a WITH =)', 'EXCLUDE'],
  ])('%s is unanalyzable', (sql, reason) => {
    const [op] = ops(sql)
    expect(op?.kind).toBe('unanalyzable')
    expect(op?.kind === 'unanalyzable' && op.reason).toContain(reason)
  })
})

describe('statement boundaries', () => {
  it('reports each statement with its UTF-16 start, end, and text', () => {
    const e = String.fromCodePoint(0xe9)
    const sql = `\n  COMMENT ON TABLE t IS '${e}t${e}';\n  -- note\n  ALTER TABLE t ADD a int;\nCREATE INDEX CONCURRENTLY i ON t (a)`
    const result = parse(sql)
    if (!result.ok) throw new Error(result.message)
    const texts = result.statements.map((s) => sql.slice(s.start, s.end))
    expect(texts).toEqual([
      `COMMENT ON TABLE t IS '${e}t${e}'`,
      'ALTER TABLE t ADD a int',
      'CREATE INDEX CONCURRENTLY i ON t (a)',
    ])
    expect(result.statements.map((s) => s.text)).toEqual(texts)
  })

  it('handles a single statement with no separators', () => {
    const result = parse('SELECT 1')
    expect(result.ok && result.statements.map((s) => [s.start, s.end])).toEqual([[0, 8]])
  })

  it.each(['', '   \n', '  -- only a comment\n'])('returns no statements for %j', (sql) => {
    const result = parse(sql)
    expect(result.ok && result.statements).toEqual([])
  })

  it('reports syntax errors with a UTF-16 position', () => {
    const grin = String.fromCodePoint(0x1f600)
    const result = parse(`SELECT '${grin}' FRM x`)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('syntax error')
      expect(result.position).toBe(`SELECT '${grin}' FRM `.length)
    }
  })
})
