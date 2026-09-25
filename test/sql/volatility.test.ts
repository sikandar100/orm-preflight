import { describe, expect, it } from 'vitest'
import { isVolatileDefault } from '../../src/sql/volatility.js'

describe('isVolatileDefault', () => {
  it.each([
    'random()',
    'gen_random_uuid()',
    'uuid_generate_v1()',
    'uuid_generate_v4()',
    'clock_timestamp()',
    'timeofday()',
    "nextval('users_id_seq'::regclass)",
    'NEXTVAL(\'"users_id_seq"\')',
    'public.gen_random_uuid()',
    '"public"."uuid_generate_v4"()',
    'md5(random()::text)',
    '(random() * 100)::int',
    'GEN_RANDOM_UUID ( )',
  ])('treats %s as volatile', (expr) => {
    expect(isVolatileDefault(expr)).toBe(true)
  })

  it.each([
    'now()',
    'CURRENT_TIMESTAMP',
    "'random()'",
    "'active'",
    '0',
    'false',
    "'{}'::jsonb",
    'my_random_thing()',
    'randomize()',
    "'it''s random()'",
  ])('treats %s as not volatile', (expr) => {
    expect(isVolatileDefault(expr)).toBe(false)
  })
})
