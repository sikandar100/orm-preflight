import { createRegistry } from './registry.js'
import { typeormAdapter } from './typeorm/index.js'
import type { OrmAdapter } from './types.js'

export { createRegistry } from './registry.js'

const registry = createRegistry([typeormAdapter])

/** Every built-in adapter. */
export const adapters: readonly OrmAdapter[] = [...registry.values()]

export function getAdapter(id: string): OrmAdapter | undefined {
  return registry.get(id)
}
