import { createInterface } from 'node:readline'

/**
 * A small Model Context Protocol server over stdio, with no dependencies. It offers tools only.
 *
 * It speaks both protocol eras, because most clients still use the older one:
 * - Legacy (2024-11-05 to 2025-11-25): the client sends `initialize` first, and the rest of
 *   the session uses that version.
 * - Modern (2026-07-28): no handshake. Every request names its version in `_meta`, and the
 *   client may call `server/discover` to learn what the server supports.
 *
 * Spec: https://modelcontextprotocol.io/specification/2026-07-28
 */

export const MODERN_VERSIONS = ['2026-07-28'] as const
export const LEGACY_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'] as const

const META_VERSION = 'io.modelcontextprotocol/protocolVersion'
const META_CAPABILITIES = 'io.modelcontextprotocol/clientCapabilities'
const META_SERVER_INFO = 'io.modelcontextprotocol/serverInfo'

/** JSON-RPC and MCP error codes. */
export const ErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  UnsupportedProtocolVersion: -32022,
} as const

export interface ServerInfo {
  name: string
  title: string
  version: string
  description: string
  websiteUrl: string
}

export interface ToolResult {
  /** Text for the model. */
  text: string
  /** Machine-readable result. Must match the tool's outputSchema when it has one. */
  structured?: Record<string, unknown>
  /** True when the tool ran but failed, such as for a bad argument. */
  isError?: boolean
}

export interface Tool {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  annotations?: Record<string, unknown>
  call(args: Record<string, unknown>): Promise<ToolResult>
}

export interface ServerOptions {
  info: ServerInfo
  /** Guidance for the model on when to use the tools. */
  instructions: string
  tools: readonly Tool[]
}

type Id = string | number
type Response =
  | { jsonrpc: '2.0'; id: Id | null; result: Record<string, unknown> }
  | { jsonrpc: '2.0'; id: Id | null; error: { code: number; message: string; data?: unknown } }

class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message)
  }
}

/**
 * Handles one decoded message at a time. Returns the response, or undefined for notifications
 * and anything else that gets no reply. Keeps the era chosen by `initialize`.
 */
export function createServer(options: ServerOptions) {
  const { info, instructions, tools } = options
  let legacyVersion: string | undefined
  const capabilities = { tools: { listChanged: false } }
  const toolList = tools.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    ...(t.outputSchema === undefined ? {} : { outputSchema: t.outputSchema }),
    ...(t.annotations === undefined ? {} : { annotations: t.annotations }),
  }))

  function initialize(params: Record<string, unknown>) {
    const requested = params.protocolVersion
    // Echo a version we support, otherwise offer our newest legacy one.
    legacyVersion =
      typeof requested === 'string' && (LEGACY_VERSIONS as readonly string[]).includes(requested)
        ? requested
        : LEGACY_VERSIONS[0]
    return { protocolVersion: legacyVersion, capabilities, serverInfo: info, instructions }
  }

  /** Modern requests carry their version in _meta. Returns true for a modern request. */
  function isModern(params: Record<string, unknown>): boolean {
    if (legacyVersion !== undefined) return false
    const meta = params._meta
    if (!isObject(meta) || !(META_VERSION in meta)) {
      throw new RpcError(
        ErrorCode.InvalidParams,
        `Missing ${META_VERSION} in _meta. Send initialize first, or use protocol version ${MODERN_VERSIONS[0]}.`,
      )
    }
    const version = meta[META_VERSION]
    if (typeof version !== 'string' || !(MODERN_VERSIONS as readonly string[]).includes(version)) {
      throw new RpcError(ErrorCode.UnsupportedProtocolVersion, 'Unsupported protocol version', {
        supported: [...MODERN_VERSIONS, ...LEGACY_VERSIONS],
        requested: version,
      })
    }
    if (!isObject(meta[META_CAPABILITIES])) {
      throw new RpcError(ErrorCode.InvalidParams, `Missing ${META_CAPABILITIES} in _meta.`)
    }
    return true
  }

  /** Adds the fields every modern result carries. */
  function modern(result: Record<string, unknown>) {
    return {
      resultType: 'complete',
      ...result,
      _meta: { [META_SERVER_INFO]: { name: info.name, version: info.version } },
    }
  }

  async function callTool(params: Record<string, unknown>) {
    const tool = tools.find((t) => t.name === params.name)
    if (tool === undefined) {
      throw new RpcError(ErrorCode.InvalidParams, `Unknown tool: ${String(params.name)}`)
    }
    const args = params.arguments ?? {}
    if (!isObject(args) || Array.isArray(args)) {
      throw new RpcError(ErrorCode.InvalidParams, 'Tool arguments must be an object.')
    }
    let result: ToolResult
    try {
      result = await tool.call(args)
    } catch (error) {
      result = { text: error instanceof Error ? error.message : String(error), isError: true }
    }
    return {
      content: [{ type: 'text', text: result.text }],
      ...(result.structured === undefined ? {} : { structuredContent: result.structured }),
      isError: result.isError === true,
    }
  }

  async function request(method: string, params: Record<string, unknown>) {
    switch (method) {
      case 'initialize':
        return initialize(params)
      case 'ping':
        return {}
      case 'server/discover':
        // A probe: answered even without the _meta envelope.
        return modern({
          supportedVersions: [...MODERN_VERSIONS],
          capabilities,
          instructions,
          ttlMs: 3_600_000,
          cacheScope: 'public',
        })
      case 'tools/list': {
        const result = { tools: toolList }
        return isModern(params)
          ? modern({ ...result, ttlMs: 3_600_000, cacheScope: 'public' })
          : result
      }
      case 'tools/call': {
        const useModern = isModern(params)
        const result = await callTool(params)
        return useModern ? modern(result) : result
      }
      default:
        throw new RpcError(ErrorCode.MethodNotFound, `Method not found: ${method}`)
    }
  }

  return {
    async handle(message: unknown): Promise<Response | undefined> {
      if (!isObject(message) || Array.isArray(message)) {
        return failure(null, ErrorCode.InvalidRequest, 'Expected a JSON-RPC object.')
      }
      const { id, method } = message
      const hasId = 'id' in message
      if (typeof method !== 'string') {
        // A response to us, which this server never asks for, or garbage.
        if ('result' in message || 'error' in message) return undefined
        return failure(isId(id) ? id : null, ErrorCode.InvalidRequest, 'Missing method.')
      }
      if (!hasId) return undefined // A notification, such as notifications/initialized.
      if (!isId(id) || message.jsonrpc !== '2.0') {
        return failure(null, ErrorCode.InvalidRequest, 'Invalid JSON-RPC request.')
      }
      const params = message.params ?? {}
      if (!isObject(params) || Array.isArray(params)) {
        return failure(id, ErrorCode.InvalidParams, 'params must be an object.')
      }
      try {
        return { jsonrpc: '2.0', id, result: await request(method, params) }
      } catch (error) {
        if (error instanceof RpcError) return failure(id, error.code, error.message, error.data)
        const text = error instanceof Error ? error.message : String(error)
        return failure(id, ErrorCode.InternalError, text)
      }
    },
  }
}

/**
 * Serves MCP over stdio: one JSON message per line in, one per line out. Resolves when the
 * input closes and every pending request has been answered. Nothing else may write to output.
 */
export async function serveStdio(
  options: ServerOptions,
  input: NodeJS.ReadableStream,
  output: { write(text: string): unknown },
): Promise<void> {
  const server = createServer(options)
  const pending = new Set<Promise<void>>()
  const send = (response: Response | undefined) => {
    // JSON.stringify escapes newlines inside strings, so each message stays on one line.
    if (response !== undefined) output.write(`${JSON.stringify(response)}\n`)
  }
  const lines = createInterface({ input, crlfDelay: Infinity })
  for await (const line of lines) {
    if (line.trim() === '') continue
    let message: unknown
    try {
      message = JSON.parse(line)
    } catch {
      send(failure(null, ErrorCode.ParseError, 'Parse error: each line must be one JSON message.'))
      continue
    }
    const task = server.handle(message).then(send)
    pending.add(task)
    void task.finally(() => pending.delete(task))
  }
  await Promise.all(pending)
}

function failure(id: Id | null, code: number, message: string, data?: unknown): Response {
  return {
    jsonrpc: '2.0',
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isId(value: unknown): value is Id {
  return typeof value === 'string' || (typeof value === 'number' && Number.isInteger(value))
}
