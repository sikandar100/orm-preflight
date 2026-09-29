import { statSync } from 'node:fs'
import path from 'node:path'
import { getAdapter } from '../adapters/index.js'
import type { ConfigOverrides } from '../config/load.js'
import { runLint } from '../lint.js'
import { type ServerOptions, serveStdio, type Tool } from '../mcp/server.js'
import { formatJson } from '../reporters/json.js'
import { version } from '../version.js'
import { allRules, explain } from './commands.js'

const DATABASES = { postgres: 'PostgreSQL', mysql: 'MySQL' } as const

const INSTRUCTIONS = `orm-preflight checks database migrations for data loss, table locks, and problems during rolling deploys, before they run. It only reads files: it never runs migrations or connects to a database.

Call check_migrations after you write or change a migration, and fix what it reports. Every finding explains what happens, why, and the safe way to make the change. Call explain_rule for a rule's full documentation.

Never add a "preflight safety-assured" suppression comment to silence a finding unless the user agrees to it, and then write their real reason in it.`

/** Read-only tools that touch nothing outside the project. */
const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

const stringOrNull = { type: ['string', 'null'] }

/** The JSON output shape (docs/json-output.md), as a JSON Schema. */
const lintOutputSchema = {
  type: 'object',
  required: ['version', 'summary', 'findings'],
  properties: {
    version: { type: 'string' },
    summary: {
      type: 'object',
      required: ['errors', 'warnings', 'suppressed', 'files', 'migrations'],
      properties: {
        errors: { type: 'integer' },
        warnings: { type: 'integer' },
        suppressed: { type: 'integer' },
        files: { type: 'integer' },
        migrations: { type: 'integer' },
      },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'ruleId',
          'severity',
          'category',
          'file',
          'line',
          'column',
          'message',
          'why',
          'safeAlternative',
          'docsUrl',
          'suppressed',
        ],
        properties: {
          ruleId: { type: 'string' },
          severity: { enum: ['error', 'warn'] },
          category: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer' },
          column: { type: 'integer' },
          message: { type: 'string' },
          why: { type: 'string' },
          safeAlternative: stringOrNull,
          docsUrl: { type: 'string' },
          suppressed: {
            anyOf: [
              { type: 'null' },
              { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } },
            ],
          },
        },
      },
    },
  },
}

/** Defaults from the command line, such as `orm-preflight mcp --dialect mysql`. */
export interface McpDefaults {
  configPath?: string
  overrides: ConfigOverrides
}

function checkMigrations(cwd: string, defaults: McpDefaults): Tool {
  return {
    name: 'check_migrations',
    title: 'Check migrations',
    description:
      'Checks database migrations for data loss, table locks, and deploy problems. Returns every finding with what happens, why, and a safe alternative. Run it after writing or changing a migration. Without files, it checks the migrations configured for the project, or every migrations folder.',
    inputSchema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Migration files or globs, relative to projectDir, such as ["src/migrations/1727200000000-AddEmail.ts"].',
        },
        changedSince: {
          type: 'string',
          description:
            'A git ref, such as origin/main. Checks only migrations added or changed since the branch left it.',
        },
        projectDir: {
          type: 'string',
          description:
            'Absolute path of the project root, where package.json is. Default: the directory the server started in.',
        },
        dialect: {
          enum: ['postgres', 'mysql'],
          description: 'The database. Default: the config, or postgres.',
        },
        postgresVersion: {
          type: 'integer',
          description: 'The PostgreSQL major version. Default: the config, or 16.',
        },
      },
      additionalProperties: false,
    },
    outputSchema: lintOutputSchema,
    annotations: READ_ONLY,
    async call(args) {
      const { files, changedSince, projectDir, dialect, postgresVersion } = args
      if (files !== undefined && !isStringArray(files)) {
        return failed('files must be an array of strings.')
      }
      if (changedSince !== undefined && typeof changedSince !== 'string') {
        return failed('changedSince must be a string.')
      }
      if (dialect !== undefined && dialect !== 'postgres' && dialect !== 'mysql') {
        return failed('dialect must be "postgres" or "mysql".')
      }
      if (postgresVersion !== undefined && !Number.isInteger(postgresVersion)) {
        return failed('postgresVersion must be a whole number.')
      }
      const unknown = Object.keys(args).filter(
        (key) =>
          !['files', 'changedSince', 'projectDir', 'dialect', 'postgresVersion'].includes(key),
      )
      if (unknown.length > 0) return failed(`Unknown argument: ${unknown.join(', ')}.`)

      let dir = cwd
      if (projectDir !== undefined) {
        if (typeof projectDir !== 'string') return failed('projectDir must be a string.')
        dir = path.resolve(cwd, projectDir)
        if (!isDirectory(dir)) return failed(`projectDir "${projectDir}" is not a directory.`)
      }

      const result = await runLint(
        {
          cwd: dir,
          patterns: files ?? [],
          ...(defaults.configPath === undefined ? {} : { configPath: defaults.configPath }),
          ...(changedSince === undefined ? {} : { changedSince }),
          overrides: {
            ...defaults.overrides,
            ...(dialect === undefined ? {} : { dialect }),
            ...(postgresVersion === undefined
              ? {}
              : { postgresVersion: postgresVersion as number }),
          },
        },
        { get: getAdapter },
      )
      const json = formatJson(result)
      return { text: json, structured: JSON.parse(json) as Record<string, unknown> }
    },
  }
}

const explainRule: Tool = {
  name: 'explain_rule',
  title: 'Explain a rule',
  description:
    "Returns a rule's documentation: what happens, bad and safe examples, when a suppression is fine, and the PostgreSQL, MySQL, or TypeORM sources behind it.",
  inputSchema: {
    type: 'object',
    properties: {
      rule: { type: 'string', description: 'The rule ID, such as no-drop-column.' },
    },
    required: ['rule'],
    additionalProperties: false,
  },
  annotations: READ_ONLY,
  call(args) {
    if (typeof args.rule !== 'string') return Promise.resolve(failed('rule must be a string.'))
    return Promise.resolve({ text: explain(args.rule) })
  },
}

const listRules: Tool = {
  name: 'list_rules',
  title: 'List rules',
  description: 'Lists every rule with its category, default severity, and databases.',
  inputSchema: { type: 'object', additionalProperties: false },
  outputSchema: {
    type: 'object',
    required: ['rules'],
    properties: {
      rules: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'category', 'defaultSeverity', 'databases', 'docsUrl'],
          properties: {
            id: { type: 'string' },
            category: { type: 'string' },
            defaultSeverity: { enum: ['error', 'warn', 'off'] },
            databases: { type: 'array', items: { type: 'string' } },
            docsUrl: { type: 'string' },
          },
        },
      },
    },
  },
  annotations: READ_ONLY,
  call() {
    const rules = allRules().map((r) => ({
      id: r.meta.id,
      category: r.meta.category,
      defaultSeverity: r.meta.defaultSeverity,
      databases: r.meta.dialects.map((d) => DATABASES[d]),
      docsUrl: r.meta.docsUrl,
    }))
    const structured = { rules }
    return Promise.resolve({ text: JSON.stringify(structured, null, 2), structured })
  },
}

/** The MCP server's tools. None of them runs migration code: --execute is not offered. */
export function mcpServerOptions(cwd: string, defaults: McpDefaults): ServerOptions {
  return {
    info: {
      name: 'orm-preflight',
      title: 'orm-preflight',
      version,
      description: 'Preflight safety checks for ORM migrations: data loss, locking, deploy safety.',
      websiteUrl: 'https://sikandar100.github.io/orm-preflight/',
    },
    instructions: INSTRUCTIONS,
    tools: [checkMigrations(cwd, defaults), explainRule, listRules],
  }
}

/** `orm-preflight mcp`: serves the tools over stdio until the client closes the input. */
export function serveMcp(
  cwd: string,
  defaults: McpDefaults,
  input: NodeJS.ReadableStream,
  output: { write(text: string): unknown },
): Promise<void> {
  return serveStdio(mcpServerOptions(cwd, defaults), input, output)
}

function failed(text: string) {
  return { text, isError: true }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

function isDirectory(dir: string): boolean {
  try {
    return statSync(dir).isDirectory()
  } catch {
    return false
  }
}
