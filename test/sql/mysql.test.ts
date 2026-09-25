import { beforeAll, describe, expect, it } from 'vitest'
import type { OperationBody } from '../../src/ir/types.js'
import {
  createMysqlLoader,
  loadMysqlParser,
  MissingParserError,
} from '../../src/sql/mysql/parse.js'
import { splitStatements } from '../../src/sql/mysql/split.js'
import type { SqlParser } from '../../src/sql/types.js'

let parse: SqlParser

beforeAll(async () => {
  parse = await loadMysqlParser()
})

function ops(sql: string): OperationBody[] {
  const result = parse(sql)
  if (!result.ok) throw new Error(`parse failed: ${result.message}`)
  return result.statements.flatMap((s) => s.ops)
}

const users = { name: 'users' }

describe('splitStatements', () => {
  it('splits on semicolons outside quotes, backticks, and comments', () => {
    const sql =
      "SELECT 'a;b'; SELECT `c;d`; -- x;y\n SELECT \"e;f\" /* g;h */; # i;j\nSELECT 'it''s;'"
    expect(splitStatements(sql).map((s) => sql.slice(s.start, s.end))).toEqual([
      "SELECT 'a;b'",
      'SELECT `c;d`',
      'SELECT "e;f" /* g;h */',
      "SELECT 'it''s;'",
    ])
  })

  it('skips a leading block comment', () => {
    const sql = '/* header; note */ SELECT 1; /* x */'
    expect(splitStatements(sql).map((s) => sql.slice(s.start, s.end))).toEqual(['SELECT 1'])
  })

  it('handles backslash escapes in strings and skips empty statements', () => {
    const sql = "  ; SELECT 'a\\';b' ;; "
    expect(splitStatements(sql).map((s) => sql.slice(s.start, s.end))).toEqual(["SELECT 'a\\';b'"])
  })

  it('treats -- without a following space as an operator, not a comment', () => {
    const sql = 'SELECT 1--1; SELECT 2'
    expect(splitStatements(sql).map((s) => sql.slice(s.start, s.end))).toEqual([
      'SELECT 1--1',
      'SELECT 2',
    ])
  })

  it('keeps an unterminated string to the end', () => {
    const sql = "SELECT 'oops; SELECT 2"
    expect(splitStatements(sql)).toEqual([{ start: 0, end: sql.length }])
  })
})

describe('MySQL statements to operations', () => {
  it.each<[string, OperationBody[]]>([
    [
      'CREATE TABLE `t` (`id` int NOT NULL AUTO_INCREMENT, PRIMARY KEY (`id`)) ENGINE=InnoDB',
      [{ kind: 'create_table', table: { name: 't' } }],
    ],
    [
      'DROP TABLE `a`, `db`.`b`',
      [
        { kind: 'drop_table', table: { name: 'a' } },
        { kind: 'drop_table', table: { schema: 'db', name: 'b' } },
      ],
    ],
    [
      'ALTER TABLE `users` ADD `name` varchar(255) NOT NULL',
      [{ kind: 'add_column', table: users, column: 'name', type: 'varchar(255)', notNull: true }],
    ],
    [
      'ALTER TABLE `users` ADD `a` decimal(10,2) UNSIGNED NULL DEFAULT 0, ADD `b` varchar(36) NOT NULL DEFAULT (UUID())',
      [
        {
          kind: 'add_column',
          table: users,
          column: 'a',
          type: 'decimal(10,2) unsigned',
          notNull: false,
          default: { expr: '0', volatile: false },
        },
        {
          kind: 'add_column',
          table: users,
          column: 'b',
          type: 'varchar(36)',
          notNull: true,
          default: { expr: 'UUID()', volatile: true },
        },
      ],
    ],
    [
      "ALTER TABLE `users` ADD `status` enum ('a', 'b') NOT NULL DEFAULT 'a'",
      [
        {
          kind: 'add_column',
          table: users,
          column: 'status',
          type: "enum('a','b')",
          notNull: true,
          default: { expr: "'a'", volatile: false },
        },
      ],
    ],
    [
      'ALTER TABLE `users` DROP COLUMN `name`',
      [{ kind: 'drop_column', table: users, column: 'name' }],
    ],
    [
      'ALTER TABLE `users` CHANGE `age` `years` int NOT NULL',
      [
        { kind: 'alter_column_type', table: users, column: 'age', to: 'int', using: false },
        { kind: 'rename_column', table: users, column: 'age', to: 'years' },
      ],
    ],
    [
      "ALTER TABLE `users` CHANGE `status` `status` enum ('active', 'banned') NOT NULL",
      [
        {
          kind: 'alter_column_type',
          table: users,
          column: 'status',
          to: "enum('active','banned')",
          using: false,
        },
      ],
    ],
    [
      'ALTER TABLE `users` MODIFY `name` varchar(500) NULL',
      [
        {
          kind: 'alter_column_type',
          table: users,
          column: 'name',
          to: 'varchar(500)',
          using: false,
        },
      ],
    ],
    [
      'ALTER TABLE `users` RENAME TO `accounts`',
      [{ kind: 'rename_table', table: users, to: 'accounts' }],
    ],
    [
      'ALTER TABLE `users` RENAME COLUMN `a` TO `b`',
      [{ kind: 'rename_column', table: users, column: 'a', to: 'b' }],
    ],
    [
      'RENAME TABLE `a` TO `b`, `c` TO `d`',
      [
        { kind: 'rename_table', table: { name: 'a' }, to: 'b' },
        { kind: 'rename_table', table: { name: 'c' }, to: 'd' },
      ],
    ],
    [
      'ALTER TABLE `posts` ADD CONSTRAINT `FK_1` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE NO ACTION',
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
      'ALTER TABLE `u` ADD CONSTRAINT `UQ` UNIQUE (`a`), ADD PRIMARY KEY (`id`), ADD CONSTRAINT `c` CHECK (a > 0)',
      [
        {
          kind: 'add_constraint',
          table: { name: 'u' },
          name: 'UQ',
          type: 'unique',
          notValid: false,
        },
        { kind: 'add_constraint', table: { name: 'u' }, type: 'primary_key', notValid: false },
        { kind: 'add_constraint', table: { name: 'u' }, name: 'c', type: 'check', notValid: false },
      ],
    ],
    [
      'ALTER TABLE `u` ADD INDEX `i` (`a`), ADD UNIQUE INDEX `IDX` (`b`)',
      [
        {
          kind: 'create_index',
          table: { name: 'u' },
          name: 'i',
          unique: false,
          concurrently: false,
        },
        {
          kind: 'create_index',
          table: { name: 'u' },
          name: 'IDX',
          unique: true,
          concurrently: false,
        },
      ],
    ],
    [
      'ALTER TABLE `posts` DROP FOREIGN KEY `FK_1`',
      [{ kind: 'drop_constraint', table: { name: 'posts' }, name: 'FK_1', type: 'foreign_key' }],
    ],
    [
      'ALTER TABLE `u` DROP PRIMARY KEY',
      [{ kind: 'drop_constraint', table: { name: 'u' }, type: 'primary_key' }],
    ],
    [
      'ALTER TABLE `u` DROP INDEX `i`, DROP KEY `k`',
      [
        { kind: 'drop_index', name: 'i', concurrently: false },
        { kind: 'drop_index', name: 'k', concurrently: false },
      ],
    ],
    [
      'CREATE UNIQUE INDEX `IDX` ON `db`.`u` (`a`)',
      [
        {
          kind: 'create_index',
          table: { schema: 'db', name: 'u' },
          name: 'IDX',
          unique: true,
          concurrently: false,
        },
      ],
    ],
    [
      'DROP INDEX `IDX_users_email` ON `users`',
      [{ kind: 'drop_index', name: 'IDX_users_email', concurrently: false }],
    ],
    ['TRUNCATE TABLE `sessions`', [{ kind: 'truncate', tables: [{ name: 'sessions' }] }]],
    ['SET lock_wait_timeout = 5', [{ kind: 'set_setting', name: 'lock_wait_timeout', value: '5' }]],
    [
      'ALTER TABLE `u` ALGORITHM=INSTANT, ADD `x` int',
      [{ kind: 'add_column', table: { name: 'u' }, column: 'x', type: 'int', notNull: false }],
    ],
    [
      'ALTER TABLE `u` ADD `a` tinyint NOT NULL DEFAULT TRUE, ADD `b` int NULL DEFAULT NULL, ADD `c` varchar(9) DEFAULT "x", ADD `d` char(32) DEFAULT (md5(uuid()))',
      [
        {
          kind: 'add_column',
          table: { name: 'u' },
          column: 'a',
          type: 'tinyint',
          notNull: true,
          default: { expr: 'TRUE', volatile: false },
        },
        {
          kind: 'add_column',
          table: { name: 'u' },
          column: 'b',
          type: 'int',
          notNull: false,
          default: { expr: 'NULL', volatile: false },
        },
        {
          kind: 'add_column',
          table: { name: 'u' },
          column: 'c',
          type: 'varchar(9)',
          notNull: false,
          default: { expr: '"x"', volatile: false },
        },
        {
          kind: 'add_column',
          table: { name: 'u' },
          column: 'd',
          type: 'char(32)',
          notNull: false,
          default: { expr: 'md5(uuid())', volatile: true },
        },
      ],
    ],
    ['ROLLBACK', [{ kind: 'transaction_control', action: 'rollback' }]],
    [
      'INSERT INTO `db`.`u` (`a`) VALUES (1)',
      [{ kind: 'data_change', table: { schema: 'db', name: 'u' }, statement: 'insert' }],
    ],
    [
      'REPLACE INTO `u` (`a`) VALUES (1)',
      [{ kind: 'data_change', table: { name: 'u' }, statement: 'insert' }],
    ],
    [
      'UPDATE `u` JOIN `v` ON 1 SET `u`.`a` = 1',
      [{ kind: 'data_change', table: { name: 'u' }, statement: 'update' }],
    ],
    [
      'DELETE FROM `u` WHERE `a` = 1',
      [{ kind: 'data_change', table: { name: 'u' }, statement: 'delete' }],
    ],
    ['START TRANSACTION', [{ kind: 'transaction_control', action: 'start' }]],
    ['COMMIT', [{ kind: 'transaction_control', action: 'commit' }]],
  ])('%s', (sql, expected) => {
    expect(ops(sql)).toEqual(expected)
  })

  it.each(['SELECT 1', 'CREATE VIEW v AS SELECT 1', 'DROP VIEW v'])(
    '%s produces no operation',
    (sql) => {
      expect(ops(sql)).toEqual([])
    },
  )

  it('reports statements the mapper does not know as unanalyzable', () => {
    const [op] = ops('GRANT SELECT ON `u` TO app')
    expect(op?.kind).toBe('unanalyzable')
  })

  it('reports each statement with its start, end, and text', () => {
    const sql = '  ALTER TABLE `t` ADD `a` int;\n -- note\n CREATE INDEX `i` ON `t` (`a`);'
    const result = parse(sql)
    expect(result.ok && result.statements.map((s) => s.text)).toEqual([
      'ALTER TABLE `t` ADD `a` int',
      'CREATE INDEX `i` ON `t` (`a`)',
    ])
  })

  it('reports a syntax error with the position inside the whole string', () => {
    const sql = 'SELECT 1; ALTER TABLE `t` ADD'
    const result = parse(sql)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.position).toBe(sql.length)
  })
})

describe('createMysqlLoader', () => {
  it('turns a missing package into MissingParserError and retries later', async () => {
    let calls = 0
    const load = createMysqlLoader(() => {
      calls++
      return Promise.reject(Object.assign(new Error('not found'), { code: 'ERR_MODULE_NOT_FOUND' }))
    })
    await expect(load()).rejects.toBeInstanceOf(MissingParserError)
    await expect(load()).rejects.toBeInstanceOf(MissingParserError)
    expect(calls).toBe(2)
  })

  it('passes other import errors through', async () => {
    const load = createMysqlLoader(() => Promise.reject(new Error('broken install')))
    await expect(load()).rejects.toThrow('broken install')
  })

  it('accepts a CommonJS module wrapped in a default export', async () => {
    class Parser {
      astify() {
        return []
      }
    }
    const load = createMysqlLoader(() => Promise.resolve({ default: { Parser } }))
    expect(await load()).toBe(Parser)
  })
})

describe('MissingParserError', () => {
  it('tells the user how to install the optional parser', () => {
    expect(new MissingParserError().message).toBe(
      'MySQL support needs the node-sql-parser package. Install it with: npm install --save-dev node-sql-parser',
    )
  })
})
