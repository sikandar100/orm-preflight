import type { OrmAdapter } from './types.js'

const ADAPTER_ID = /^[a-z][a-z0-9-]*$/

/**
 * Builds the adapter lookup and checks every adapter at startup. Throws when an adapter
 * rule ID is not `<adapter-id>/<name>`, so a misnamed rule can never reach users.
 */
export function createRegistry(list: readonly OrmAdapter[]): ReadonlyMap<string, OrmAdapter> {
  const registry = new Map<string, OrmAdapter>()
  for (const adapter of list) {
    if (!ADAPTER_ID.test(adapter.id)) throw new Error(`Invalid adapter ID "${adapter.id}"`)
    if (registry.has(adapter.id)) throw new Error(`Duplicate adapter ID "${adapter.id}"`)
    const prefix = `${adapter.id}/`
    for (const { meta } of adapter.rules) {
      if (!meta.id.startsWith(prefix) || meta.id.length === prefix.length) {
        throw new Error(
          `Rule "${meta.id}" of adapter "${adapter.id}" must be named "${prefix}<name>"`,
        )
      }
      if (meta.adapter !== adapter.id) {
        throw new Error(`Rule "${meta.id}" must set meta.adapter to "${adapter.id}"`)
      }
    }
    registry.set(adapter.id, adapter)
  }
  return registry
}
