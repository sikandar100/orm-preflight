import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'
import {
  createServer,
  ErrorCode,
  LEGACY_VERSIONS,
  MODERN_VERSIONS,
  type ServerOptions,
  serveStdio,
} from '../../src/mcp/server.js'

const options: ServerOptions = {
  info: {
    name: 'test-server',
    title: 'Test server',
    version: '1.2.3',
    description: 'For tests',
    websiteUrl: 'https://example.com',
  },
  instructions: 'Use echo.',
  tools: [
    {
      name: 'echo',
      title: 'Echo',
      description: 'Returns its input.',
      inputSchema: { type: 'object' },
      annotations: { readOnlyHint: true },
      call: (args) => Promise.resolve({ text: JSON.stringify(args), structured: args }),
    },
    {
      name: 'broken',
      title: 'Broken',
      description: 'Always throws.',
      inputSchema: { type: 'object' },
      call: () => Promise.reject(new Error('it broke')),
    },
  ],
}

const modernMeta = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
}

function request(id: number, method: string, params?: Record<string, unknown>) {
  return { jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) }
}

describe('legacy era (initialize handshake)', () => {
  it('echoes a supported protocol version and describes the server', async () => {
    const server = createServer(options)
    const response = await server.handle(
      request(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {} }),
    )
    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: options.info,
        instructions: 'Use echo.',
      },
    })
  })

  it.each(LEGACY_VERSIONS)('accepts %s', async (version) => {
    const response = await createServer(options).handle(
      request(1, 'initialize', { protocolVersion: version }),
    )
    expect(response).toMatchObject({ result: { protocolVersion: version } })
  })

  it('offers its newest legacy version for an unknown one', async () => {
    const response = await createServer(options).handle(
      request(1, 'initialize', { protocolVersion: '1999-01-01' }),
    )
    expect(response).toMatchObject({ result: { protocolVersion: '2025-11-25' } })
  })

  it('lists and calls tools without the modern fields', async () => {
    const server = createServer(options)
    await server.handle(request(1, 'initialize', { protocolVersion: '2025-11-25' }))
    expect(await server.handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBe(
      undefined,
    )

    const list = await server.handle(request(2, 'tools/list'))
    expect(list).toEqual({
      jsonrpc: '2.0',
      id: 2,
      result: {
        tools: [
          {
            name: 'echo',
            title: 'Echo',
            description: 'Returns its input.',
            inputSchema: { type: 'object' },
            annotations: { readOnlyHint: true },
          },
          {
            name: 'broken',
            title: 'Broken',
            description: 'Always throws.',
            inputSchema: { type: 'object' },
          },
        ],
      },
    })

    const call = await server.handle(
      request(3, 'tools/call', { name: 'echo', arguments: { a: 1 } }),
    )
    expect(call).toEqual({
      jsonrpc: '2.0',
      id: 3,
      result: {
        content: [{ type: 'text', text: '{"a":1}' }],
        structuredContent: { a: 1 },
        isError: false,
      },
    })
  })

  it('answers ping', async () => {
    expect(await createServer(options).handle(request(1, 'ping'))).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {},
    })
  })
})

describe('modern era (2026-07-28, no handshake)', () => {
  it('answers server/discover', async () => {
    const response = await createServer(options).handle(
      request(1, 'server/discover', { _meta: modernMeta }),
    )
    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {
        resultType: 'complete',
        supportedVersions: [...MODERN_VERSIONS],
        capabilities: { tools: { listChanged: false } },
        instructions: 'Use echo.',
        ttlMs: 3_600_000,
        cacheScope: 'public',
        _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'test-server', version: '1.2.3' } },
      },
    })
  })

  it('lists tools with the cache fields and calls them', async () => {
    const server = createServer(options)
    const list = await server.handle(request(1, 'tools/list', { _meta: modernMeta }))
    expect(list).toMatchObject({
      result: { resultType: 'complete', ttlMs: 3_600_000, cacheScope: 'public' },
    })
    const call = await server.handle(
      request(2, 'tools/call', { _meta: modernMeta, name: 'echo', arguments: { b: 2 } }),
    )
    expect(call).toMatchObject({
      result: { resultType: 'complete', structuredContent: { b: 2 }, isError: false },
    })
  })

  it('rejects a request without the _meta envelope', async () => {
    const response = await createServer(options).handle(request(1, 'tools/list'))
    expect(response).toMatchObject({ error: { code: ErrorCode.InvalidParams } })
  })

  it('rejects a request without client capabilities', async () => {
    const response = await createServer(options).handle(
      request(1, 'tools/list', {
        _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' },
      }),
    )
    expect(response).toMatchObject({ error: { code: ErrorCode.InvalidParams } })
  })

  it('names the supported versions for an unsupported one', async () => {
    const response = await createServer(options).handle(
      request(1, 'tools/list', {
        _meta: { ...modernMeta, 'io.modelcontextprotocol/protocolVersion': '2099-01-01' },
      }),
    )
    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: ErrorCode.UnsupportedProtocolVersion,
        message: 'Unsupported protocol version',
        data: { supported: [...MODERN_VERSIONS, ...LEGACY_VERSIONS], requested: '2099-01-01' },
      },
    })
  })
})

describe('errors', () => {
  const server = createServer(options)

  it('reports an unknown method', async () => {
    expect(await server.handle(request(1, 'resources/list', { _meta: modernMeta }))).toMatchObject({
      id: 1,
      error: { code: ErrorCode.MethodNotFound },
    })
  })

  it('reports an unknown tool as a protocol error', async () => {
    const response = await server.handle(
      request(1, 'tools/call', { _meta: modernMeta, name: 'nope' }),
    )
    expect(response).toMatchObject({
      error: { code: ErrorCode.InvalidParams, message: 'Unknown tool: nope' },
    })
  })

  it('reports a tool that throws as a tool error, not a protocol error', async () => {
    const response = await server.handle(
      request(1, 'tools/call', { _meta: modernMeta, name: 'broken' }),
    )
    expect(response).toMatchObject({
      result: { content: [{ type: 'text', text: 'it broke' }], isError: true },
    })
  })

  it('rejects arguments that are not an object', async () => {
    const response = await server.handle(
      request(1, 'tools/call', { _meta: modernMeta, name: 'echo', arguments: [1] }),
    )
    expect(response).toMatchObject({ error: { code: ErrorCode.InvalidParams } })
  })

  it('rejects batches and malformed requests', async () => {
    expect(await server.handle([request(1, 'ping')])).toMatchObject({
      id: null,
      error: { code: ErrorCode.InvalidRequest },
    })
    expect(await server.handle({ jsonrpc: '2.0', id: null, method: 'ping' })).toMatchObject({
      error: { code: ErrorCode.InvalidRequest },
    })
    expect(await server.handle({ jsonrpc: '1.0', id: 1, method: 'ping' })).toMatchObject({
      error: { code: ErrorCode.InvalidRequest },
    })
    expect(await server.handle({ jsonrpc: '2.0', id: 1 })).toMatchObject({
      id: 1,
      error: { code: ErrorCode.InvalidRequest },
    })
    expect(await server.handle('ping')).toMatchObject({ error: { code: ErrorCode.InvalidRequest } })
  })

  it('ignores responses and notifications', async () => {
    expect(await server.handle({ jsonrpc: '2.0', id: 1, result: {} })).toBe(undefined)
    expect(await server.handle({ jsonrpc: '2.0', method: 'notifications/cancelled' })).toBe(
      undefined,
    )
  })
})

describe('stdio', () => {
  async function exchange(lines: string[]): Promise<unknown[]> {
    const input = new PassThrough()
    let written = ''
    const done = serveStdio(options, input, { write: (text: string) => (written += text) })
    input.end(lines.map((l) => `${l}\n`).join(''))
    await done
    return written
      .split('\n')
      .filter((l) => l !== '')
      .map((l) => JSON.parse(l) as unknown)
  }

  it('answers one message per line and finishes when the input closes', async () => {
    const replies = await exchange([
      JSON.stringify(request(1, 'initialize', { protocolVersion: '2025-11-25' })),
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      '',
      JSON.stringify(request(2, 'tools/call', { name: 'echo', arguments: { text: 'a\nb' } })),
    ])
    expect(replies).toHaveLength(2)
    expect(replies[1]).toMatchObject({ id: 2, result: { structuredContent: { text: 'a\nb' } } })
  })

  it('reports a line that is not JSON and keeps going', async () => {
    const replies = await exchange(['{oops', JSON.stringify(request(1, 'ping'))])
    expect(replies).toMatchObject([
      { jsonrpc: '2.0', id: null, error: { code: ErrorCode.ParseError } },
      { jsonrpc: '2.0', id: 1, result: {} },
    ])
    expect(replies).toHaveLength(2)
  })

  it('accepts Windows line endings', async () => {
    const input = new PassThrough()
    let written = ''
    const done = serveStdio(options, input, { write: (text: string) => (written += text) })
    input.end(`${JSON.stringify(request(1, 'ping'))}\r\n`)
    await done
    expect(JSON.parse(written)).toEqual({ jsonrpc: '2.0', id: 1, result: {} })
  })
})
