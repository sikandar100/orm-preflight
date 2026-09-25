import type { ExtractedMigration } from '../ir/types.js'
import type { Dialect, Rule } from '../rules/types.js'

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
}
