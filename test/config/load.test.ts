import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { configSchema, loadConfig, resolveConfig } from '../../src/config/load.js'
import { ConfigError } from '../../src/errors.js'
import { coreRules } from '../../src/rules/index.js'
import { typeormAdapter } from '../../src/adapters/typeorm/index.js'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'orm-preflight-config-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('loadConfig', () => {
  it('uses defaults when there is no config', () => {
    expect(loadConfig(dir)).toEqual({
      source: undefined,
      orm: 'typeorm',
      dialect: 'postgres',
      postgresVersion: 16,
      migrations: undefined,
      startAfter: undefined,
      defaultSchema: 'public',
      adapterOptions: {},
      rules: {},
    })
  })

  it('reads orm-preflight.config.json before package.json', () => {
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ ormPreflight: { postgresVersion: 14 } }),
    )
    expect(loadConfig(dir).postgresVersion).toBe(14)
    writeFileSync(
      path.join(dir, 'orm-preflight.config.json'),
      JSON.stringify({ postgresVersion: 17 }),
    )
    expect(loadConfig(dir)).toMatchObject({
      postgresVersion: 17,
      source: 'orm-preflight.config.json',
    })
  })

  it('reads an explicit config path', () => {
    writeFileSync(
      path.join(dir, 'custom.json'),
      JSON.stringify({ dialect: 'mysql', typeorm: { transactionMode: 'each' } }),
    )
    expect(loadConfig(dir, 'custom.json')).toMatchObject({
      dialect: 'mysql',
      defaultSchema: undefined,
      adapterOptions: { transactionMode: 'each' },
      source: 'custom.json',
    })
  })

  it.each([
    [
      { rules: { 'no-drop-colum': 'off' } },
      'Invalid config in orm-preflight.config.json: "rules.no-drop-colum" is not a known setting. Did you mean "no-drop-column"?',
    ],
    [
      { dialect: 'sqlite' },
      'Invalid config in orm-preflight.config.json: "dialect" must be one of "postgres", "mysql", but is "sqlite".',
    ],
    [
      { postgresVersion: 9 },
      'Invalid config in orm-preflight.config.json: "postgresVersion" must be at least 12.',
    ],
    [
      { postgresVersion: 16.5 },
      'Invalid config in orm-preflight.config.json: "postgresVersion" must be a whole number.',
    ],
    [
      { migrations: [] },
      'Invalid config in orm-preflight.config.json: "migrations" must have at least 1 item.',
    ],
    [
      { migrations: [3] },
      'Invalid config in orm-preflight.config.json: "migrations[0]" must be a string.',
    ],
    [
      { typeorm: { transactionMod: 'each' } },
      'Invalid config in orm-preflight.config.json: "typeorm.transactionMod" is not a known setting. Did you mean "transactionMode"?',
    ],
    [
      { rules: { 'no-drop-column': 'fatal' } },
      'Invalid config in orm-preflight.config.json: "rules.no-drop-column" must be one of "error", "warn", "off", but is "fatal".',
    ],
    [[], 'Invalid config in orm-preflight.config.json: The config must be an object.'],
    [
      { startAfter: 'yesterday' },
      'Invalid config in orm-preflight.config.json: "startAfter" must be a number.',
    ],
    [
      { defaultSchema: '' },
      'Invalid config in orm-preflight.config.json: "defaultSchema" must not be empty.',
    ],
    [
      { unknown: true },
      'Invalid config in orm-preflight.config.json: "unknown" is not a known setting.',
    ],
  ])('rejects %j with a precise message', (config, message) => {
    writeFileSync(path.join(dir, 'orm-preflight.config.json'), JSON.stringify(config))
    expect(() => loadConfig(dir)).toThrow(new ConfigError(message))
  })

  it('reports invalid JSON and a missing config file', () => {
    writeFileSync(path.join(dir, 'orm-preflight.config.json'), '{ "dialect": ')
    expect(() => loadConfig(dir)).toThrow(/orm-preflight.config.json is not valid JSON/)
    expect(() => loadConfig(dir, 'nope.json')).toThrow('Config file not found: nope.json')
  })

  it('applies command-line overrides and names the flag when one is invalid', () => {
    expect(
      resolveConfig({ postgresVersion: 14 }, 'x', { postgresVersion: 17, dialect: 'mysql' }),
    ).toMatchObject({
      postgresVersion: 17,
      dialect: 'mysql',
    })
    expect(() => resolveConfig({}, undefined, { dialect: 'oracle' })).toThrow(
      'Invalid command-line option: --dialect must be one of "postgres", "mysql", but is "oracle".',
    )
  })
})

describe('schema.json', () => {
  it('lists exactly the rules that exist', () => {
    const properties = (configSchema.properties?.rules?.properties ?? {}) as Record<string, unknown>
    const ids = [...coreRules, ...typeormAdapter.rules].map((r) => r.meta.id).sort()
    expect(Object.keys(properties).sort()).toEqual(ids)
  })

  it('uses the adapter schema for the typeorm key', () => {
    expect(configSchema.properties?.typeorm).toMatchObject(
      JSON.parse(JSON.stringify(typeormAdapter.configSchema)) as object,
    )
  })
})
