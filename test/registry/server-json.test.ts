import { readFileSync } from 'node:fs'
import Ajv from 'ajv'
import ajvFormats from 'ajv-formats'
import { describe, expect, it } from 'vitest'

/**
 * server.json is the listing for the official MCP Registry. It is checked against the
 * registry's schema (2025-12-11, vendored in fixtures from static.modelcontextprotocol.io),
 * and it must name the same server and version as package.json, which the registry checks
 * against the npm package through "mcpName".
 */
function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as Record<string, unknown>
}

const server = readJson('../../server.json') as {
  $schema: string
  name: string
  version: string
  packages: { identifier: string; version: string }[]
}
const pkg = readJson('../../package.json') as { name: string; version: string; mcpName: string }

describe('server.json', () => {
  it('matches the MCP Registry schema', () => {
    const ajv = new Ajv.default({ allErrors: true, strict: false })
    ajvFormats.default(ajv)
    const validate = ajv.compile(readJson('./fixtures/server.schema.2025-12-11.json'))
    expect(validate(server), JSON.stringify(validate.errors)).toBe(true)
    expect(server.$schema).toBe(
      'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
    )
  })

  it('names the npm package and its version', () => {
    expect(server.name).toBe(pkg.mcpName)
    expect(server.name.startsWith('io.github.sikandar100/')).toBe(true)
    expect(server.version).toBe(pkg.version)
    expect(server.packages).toEqual([
      expect.objectContaining({ identifier: pkg.name, version: pkg.version }),
    ])
  })
})
