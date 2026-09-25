/** The subset of JSON Schema that orm-preflight's own schemas use. */
export interface JsonSchema {
  type?: 'object' | 'string' | 'integer' | 'number' | 'boolean' | 'array'
  enum?: readonly unknown[]
  properties?: Readonly<Record<string, JsonSchema>>
  additionalProperties?: boolean | JsonSchema
  items?: JsonSchema
  minimum?: number
  minItems?: number
  minLength?: number
  $ref?: string
  definitions?: Readonly<Record<string, JsonSchema>>
  [key: string]: unknown
}

/**
 * Validates a value against a schema. Returns the first problem as a plain sentence that
 * names the exact key, or undefined when the value is valid.
 */
export function validate(
  value: unknown,
  schema: JsonSchema,
  root: JsonSchema = schema,
  path = '',
): string | undefined {
  const s = resolve(schema, root)
  const at = path === '' ? 'The config' : `"${path}"`

  if (s.enum !== undefined && !s.enum.includes(value)) {
    return `${at} must be one of ${s.enum.map((v) => JSON.stringify(v)).join(', ')}, but is ${JSON.stringify(value)}.`
  }
  switch (s.type) {
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value))
        return `${at} must be an object.`
      const record = value as Record<string, unknown>
      for (const [key, child] of Object.entries(record)) {
        const childPath = path === '' ? key : `${path}.${key}`
        const known = s.properties?.[key]
        if (known !== undefined) {
          const problem = validate(child, known, root, childPath)
          if (problem !== undefined) return problem
        } else if (s.additionalProperties === false) {
          const suggestion = closest(key, Object.keys(s.properties ?? {}))
          return `"${childPath}" is not a known setting.${suggestion === undefined ? '' : ` Did you mean "${suggestion}"?`}`
        } else if (typeof s.additionalProperties === 'object') {
          const problem = validate(child, s.additionalProperties, root, childPath)
          if (problem !== undefined) return problem
        }
      }
      return undefined
    }
    case 'array': {
      if (!Array.isArray(value)) return `${at} must be an array.`
      if (s.minItems !== undefined && value.length < s.minItems) {
        return `${at} must have at least ${String(s.minItems)} item${s.minItems === 1 ? '' : 's'}.`
      }
      if (s.items === undefined) return undefined
      for (const [i, item] of value.entries()) {
        const problem = validate(item, s.items, root, `${path}[${String(i)}]`)
        if (problem !== undefined) return problem
      }
      return undefined
    }
    case 'string':
      if (typeof value !== 'string') return `${at} must be a string.`
      if (s.minLength !== undefined && value.length < s.minLength) return `${at} must not be empty.`
      return undefined
    case 'integer':
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return `${at} must be a number.`
      if (s.type === 'integer' && !Number.isInteger(value)) return `${at} must be a whole number.`
      if (s.minimum !== undefined && value < s.minimum)
        return `${at} must be at least ${String(s.minimum)}.`
      return undefined
    case 'boolean':
      return typeof value === 'boolean' ? undefined : `${at} must be true or false.`
    default:
      return undefined
  }
}

function resolve(schema: JsonSchema, root: JsonSchema): JsonSchema {
  if (schema.$ref === undefined) return schema
  const name = schema.$ref.replace(/^#\/definitions\//, '')
  const target = root.definitions?.[name]
  if (target === undefined) throw new Error(`Unknown schema reference ${schema.$ref}`)
  return target
}

/** The known key closest to a mistyped one, when it is close enough to be a typo. */
export function closest(input: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined
  let bestDistance = Math.max(2, Math.floor(input.length / 3)) + 1
  for (const candidate of candidates) {
    const d = distance(input.toLowerCase(), candidate.toLowerCase())
    if (d < bestDistance) {
      best = candidate
      bestDistance = d
    }
  }
  return best
}

function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current.push(
        Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost),
      )
    }
    previous = current
  }
  return previous[b.length] ?? 0
}
