import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { afterEach, describe, expect, it } from 'vitest'

/**
 * The built `orm-preflight mcp`, driven by the official MCP client library in both protocol
 * eras. The client validates every result, including structuredContent against outputSchema.
 */
const cli = fileURLToPath(new URL('../../dist/cli.mjs', import.meta.url))
const project = fileURLToPath(new URL('fixtures/project/', import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  version: string
}

const MODES = [
  { era: 'legacy', mode: 'legacy', version: '2025-11-25' },
  { era: 'modern', mode: { pin: '2026-07-28' }, version: '2026-07-28' },
  { era: 'auto', mode: 'auto', version: '2026-07-28' },
] as const

let client: Client | undefined

afterEach(async () => {
  await client?.close()
  client = undefined
})

async function connect(mode: (typeof MODES)[number]['mode'], args: string[] = []) {
  client = new Client(
    { name: 'orm-preflight-test', version: '0.0.0' },
    { versionNegotiation: { mode } },
  )
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cli, 'mcp', ...args],
    cwd: project,
    stderr: 'pipe',
  })
  await client.connect(transport)
  return client
}

describe.each(MODES)('orm-preflight mcp ($era era)', ({ mode, version }) => {
  it('connects and describes itself', async () => {
    const c = await connect(mode)
    expect(c.getNegotiatedProtocolVersion()).toBe(version)
    expect(c.getServerVersion()).toMatchObject({ name: 'orm-preflight', version: pkg.version })
    expect(c.getInstructions()).toContain('check_migrations')
  })

  it('lists three read-only tools', async () => {
    const c = await connect(mode)
    const { tools } = await c.listTools()
    expect(tools.map((t) => t.name)).toEqual(['check_migrations', 'explain_rule', 'list_rules'])
    for (const tool of tools) expect(tool.annotations?.readOnlyHint).toBe(true)
  })

  it('checks the project migrations', async () => {
    const c = await connect(mode)
    const result = await c.callTool({ name: 'check_migrations', arguments: {} })
    expect(result.isError).toBe(false)
    const output = result.structuredContent as {
      summary: Record<string, number>
      findings: { ruleId: string; suppressed: unknown }[]
    }
    expect(output.summary).toEqual({
      errors: 2,
      warnings: 2,
      suppressed: 1,
      files: 4,
      migrations: 3,
    })
    expect(output.findings.map((f) => f.ruleId)).toContain('no-drop-and-recreate-column')
  })

  it('reports a bad argument as a tool error', async () => {
    const c = await connect(mode)
    const result = await c.callTool({ name: 'explain_rule', arguments: { rule: 'no-drop-colum' } })
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain('Did you mean \\"no-drop-column\\"?')
  })
})

describe('orm-preflight mcp tools', () => {
  it('checks only the given files', async () => {
    const c = await connect('legacy')
    const result = await c.callTool({
      name: 'check_migrations',
      arguments: { files: ['src/migrations/1727100000000-WidenUserName.ts'] },
    })
    expect(result.structuredContent).toMatchObject({ summary: { errors: 2, files: 1 } })
  })

  it('uses command line flags as defaults', async () => {
    const c = await connect('legacy', ['--postgres-version', '11'])
    const result = await c.callTool({ name: 'check_migrations', arguments: {} })
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain('--postgres-version must be at least 12')
  })

  it('explains a rule', async () => {
    const c = await connect('legacy')
    const result = await c.callTool({ name: 'explain_rule', arguments: { rule: 'no-drop-column' } })
    expect(result.isError).toBe(false)
    expect(JSON.stringify(result.content)).toContain('# no-drop-column')
  })

  it('lists every rule', async () => {
    const c = await connect('legacy')
    const result = await c.callTool({ name: 'list_rules', arguments: {} })
    const { rules } = result.structuredContent as { rules: { id: string }[] }
    expect(rules.map((r) => r.id)).toContain('typeorm/no-changecolumn-recreate')
  })
})
