import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import schemaJson from '../../schema.json' with { type: 'json' }
import { ConfigError } from '../errors.js'
import type { Dialect, Severity } from '../rules/types.js'
import { type JsonSchema, validate } from './validate.js'

export const CONFIG_FILE = 'orm-preflight.config.json'
export const PACKAGE_KEY = 'ormPreflight'

/** The JSON Schema shipped as schema.json. */
export const configSchema = schemaJson as JsonSchema

export interface ResolvedConfig {
  /** The file the config came from, or undefined when defaults are used. */
  source: string | undefined
  orm: string
  dialect: Dialect
  postgresVersion: number
  /** Migration globs, or undefined to use the adapter's default location. */
  migrations: string[] | undefined
  startAfter: number | undefined
  defaultSchema: string | undefined
  /** Options under the key named after the ORM, such as `typeorm`. */
  adapterOptions: Record<string, unknown>
  rules: Record<string, Severity>
}

/** Values from command-line flags, which take precedence over the config file. */
export interface ConfigOverrides {
  orm?: string | undefined
  dialect?: string | undefined
  postgresVersion?: number | undefined
}

interface RawConfig {
  orm?: string
  dialect?: Dialect
  postgresVersion?: number
  migrations?: string[]
  startAfter?: number
  defaultSchema?: string
  rules?: Record<string, Severity>
  [key: string]: unknown
}

/**
 * Finds and validates the config: the path given with --config, else
 * orm-preflight.config.json in `cwd`, else the "ormPreflight" key of package.json, else
 * defaults. Throws ConfigError with a message that names the exact problem.
 */
export function loadConfig(
  cwd: string,
  configPath?: string,
  overrides: ConfigOverrides = {},
): ResolvedConfig {
  const { raw, source } = readRaw(cwd, configPath)
  return resolveConfig(raw, source, overrides)
}

/** Validates a parsed config and applies defaults and overrides. */
export function resolveConfig(
  raw: unknown,
  source: string | undefined,
  overrides: ConfigOverrides = {},
): ResolvedConfig {
  const problem = validate(raw, configSchema)
  if (problem !== undefined)
    throw new ConfigError(`Invalid config in ${source ?? 'defaults'}: ${problem}`)

  // Validated against the schema above, so the shape is known.
  const merged: RawConfig = { ...(raw as RawConfig) }
  if (overrides.orm !== undefined) merged.orm = overrides.orm
  if (overrides.dialect !== undefined) merged.dialect = overrides.dialect as Dialect
  if (overrides.postgresVersion !== undefined) merged.postgresVersion = overrides.postgresVersion
  const overrideProblem = validate(merged, configSchema)
  if (overrideProblem !== undefined) {
    throw new ConfigError(
      `Invalid command-line option: ${overrideProblem.replace(/^"(\w+)"/, flagName)}`,
    )
  }

  const orm = merged.orm ?? 'typeorm'
  const dialect = merged.dialect ?? 'postgres'
  return {
    source,
    orm,
    dialect,
    postgresVersion: merged.postgresVersion ?? 16,
    migrations: merged.migrations,
    startAfter: merged.startAfter,
    defaultSchema: merged.defaultSchema ?? (dialect === 'postgres' ? 'public' : undefined),
    adapterOptions: (merged[orm] as Record<string, unknown> | undefined) ?? {},
    rules: merged.rules ?? {},
  }
}

function flagName(match: string): string {
  const key = match.slice(1, -1)
  const flags: Record<string, string> = {
    orm: '--orm',
    dialect: '--dialect',
    postgresVersion: '--postgres-version',
  }
  return flags[key] ?? match
}

function readRaw(
  cwd: string,
  configPath: string | undefined,
): { raw: unknown; source: string | undefined } {
  if (configPath !== undefined) {
    const file = path.resolve(cwd, configPath)
    if (!existsSync(file)) throw new ConfigError(`Config file not found: ${configPath}`)
    return { raw: parseJson(file, configPath), source: configPath }
  }
  const file = path.join(cwd, CONFIG_FILE)
  if (existsSync(file)) return { raw: parseJson(file, CONFIG_FILE), source: CONFIG_FILE }

  const pkg = path.join(cwd, 'package.json')
  if (existsSync(pkg)) {
    const manifest = parseJson(pkg, 'package.json') as Record<string, unknown> | null
    const section = manifest?.[PACKAGE_KEY]
    if (section !== undefined) return { raw: section, source: `package.json ("${PACKAGE_KEY}")` }
  }
  return { raw: {}, source: undefined }
}

function parseJson(file: string, label: string): unknown {
  const text = readFileSync(file, 'utf8')
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new ConfigError(`${label} is not valid JSON: ${detail}`)
  }
}
