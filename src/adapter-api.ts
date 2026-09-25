/**
 * The contract between the core and ORM adapters. It lives in the core, so the core never
 * imports an adapter; adapters implement it and src/adapters/types.ts re-exports it.
 */
import type { ExtractedMigration } from './ir/types.js'
import type { Dialect, Rule } from './rules/types.js'

/** A migration file's contents. The path is used as given in every reported location. */
export interface SourceFile {
  path: string
  text: string
}

export interface AdapterContext {
  dialect: Dialect
  /** Adapter options from the config key named after the adapter, already validated. */
  options: Readonly<Record<string, unknown>>
}

export interface OrmAdapter {
  /** For example 'typeorm'. Prefixes the adapter's rule IDs and operation kinds. */
  id: string
  /** Used when the config has no "migrations" globs. */
  defaultMigrationGlobs: string[]
  /** JSON Schema for this adapter's config key. */
  configSchema: object
  /** Static extraction. Must never import or execute user code. */
  extract(file: SourceFile, ctx: AdapterContext): ExtractedMigration[]
  /** Optional dynamic extraction for --execute. */
  extractDynamic?(path: string, ctx: AdapterContext): Promise<ExtractedMigration[]>
  /** Adapter rules. Every ID must be `<adapter-id>/<name>`. */
  rules: Rule[]
  /** Written under the adapter's config key by `orm-preflight init`. */
  starterOptions?: Record<string, unknown>
  /** Printed by `orm-preflight init` after writing the config: what to check in it. */
  starterNote?: string
}
