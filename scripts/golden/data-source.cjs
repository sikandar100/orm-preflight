// Entities for generating real TypeORM migrations, one scenario at a time.
// Environment: DB=postgres|mysql, SCENARIO=<name>, PHASE=before|after.
// TypeORM is loaded from the working directory, so each TypeORM version runs from its own
// install. See scripts/golden/generate.sh.
const path = require('node:path')
const { DataSource, EntitySchema } = require(path.join(process.cwd(), 'node_modules/typeorm'))

const scenario = process.env.SCENARIO
const after = process.env.PHASE === 'after'
const is = (name) => after && scenario === name

const statuses = is('add-enum-value')
  ? ['active', 'inactive', 'banned']
  : is('remove-enum-value')
    ? ['active']
    : ['active', 'inactive']

const users = new EntitySchema({
  name: 'User',
  tableName: 'users',
  columns: {
    id: { type: 'int', primary: true, generated: 'increment' },
    name: { type: 'varchar', length: is('widen-varchar') ? 255 : 100 },
    email: { type: 'varchar', unique: is('add-unique') },
    ...(is('rename-property')
      ? { years: { type: 'int' } }
      : { age: { type: is('int-to-bigint') ? 'bigint' : 'int' } }),
    status: { type: 'enum', enum: statuses },
    ...(is('add-not-null-column') ? { nickname: { type: 'varchar' } } : {}),
    bio: { type: 'varchar', nullable: !is('make-required') },
    ...(is('remove-column') ? {} : { legacyCode: { type: 'varchar', nullable: true } }),
  },
  indices: is('add-index') ? [{ name: 'IDX_users_email', columns: ['email'] }] : [],
})

const posts = new EntitySchema({
  name: 'Post',
  tableName: 'posts',
  columns: {
    id: { type: 'int', primary: true, generated: 'increment' },
    title: { type: 'varchar' },
    authorId: { type: 'int' },
  },
  relations: is('add-relation')
    ? { author: { type: 'many-to-one', target: 'User', joinColumn: { name: 'authorId' } } }
    : {},
})

const mysql = process.env.DB === 'mysql'
module.exports = {
  default: new DataSource({
    type: mysql ? 'mysql' : 'postgres',
    url: mysql
      ? 'mysql://root:root@127.0.0.1:53306/gen'
      : 'postgres://postgres:postgres@127.0.0.1:55432/gen',
    entities: [users, posts],
    synchronize: false,
    logging: false,
  }),
}
