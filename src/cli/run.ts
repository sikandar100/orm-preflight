import { parseArgs } from 'node:util'
import { getAdapter } from '../adapters/index.js'
import type { ConfigOverrides } from '../config/load.js'
import { UsageError } from '../errors.js'
import { runLint } from '../lint.js'
import { formatJson } from '../reporters/json.js'
import { formatPretty } from '../reporters/pretty.js'
import { version } from '../version.js'
import { explain, formatRules, init } from './commands.js'
import { ExitCode } from './exit-codes.js'

export interface CliIo {
  stdout: (text: string) => void
  stderr: (text: string) => void
  /** The project directory. Defaults to the current directory. */
  cwd?: string
  /** Whether stdout supports colors. `--no-color` turns them off. Defaults to false. */
  color?: boolean
}

const ISSUES_URL = 'https://github.com/sikandar100/orm-preflight/issues'

export const helpText = `Usage: orm-preflight [files or globs...] [options]
       orm-preflight <command> [arguments]

Preflight safety checks for ORM migrations. Without files, checks the "migrations" globs
from the config, or the ORM's default location.

Options
  -c, --config <path>         Config file (default: orm-preflight.config.json, then the
                              "ormPreflight" key in package.json)
  --dialect <postgres|mysql>  Database dialect (default: postgres)
  --postgres-version <n>      PostgreSQL major version the migrations run on (default: 16)
  --orm <typeorm>             ORM adapter (default: typeorm)
  --changed-since <git-ref>   Check only migrations added or changed since the merge base
                              with <git-ref>, such as origin/main
  --format <pretty|json>      Output format (default: pretty)
  --max-warnings <n>          Fail when there are more than n warnings (default: no limit)
  --no-color                  Print without colors
  -h, --help                  Print this help
  -v, --version               Print the version

Commands
  rules                       List every rule with its category and default severity
  explain <rule>              Print a rule's documentation
  init [files or globs...]    Write orm-preflight.config.json, with startAfter set to the
                              newest existing migration

Exit codes
  0  No errors, and no more warnings than --max-warnings
  1  Errors, or more warnings than --max-warnings
  2  Usage, config, or internal error
`

const OPTIONS = {
  config: { type: 'string', short: 'c' },
  dialect: { type: 'string' },
  'postgres-version': { type: 'string' },
  orm: { type: 'string' },
  'changed-since': { type: 'string' },
  format: { type: 'string' },
  'max-warnings': { type: 'string' },
  'no-color': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
} as const

const FORMATS = ['pretty', 'json'] as const

/** Runs the CLI with the given arguments and resolves with the exit code. Never exits the process. */
export async function run(argv: readonly string[], io: CliIo): Promise<ExitCode> {
  try {
    return await dispatch(argv, io)
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`orm-preflight: ${error.message}\n`)
    } else {
      const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
      io.stderr(`orm-preflight: internal error: ${detail}\nPlease report it at ${ISSUES_URL}\n`)
    }
    return ExitCode.UsageOrInternalError
  }
}

async function dispatch(argv: readonly string[], io: CliIo): Promise<ExitCode> {
  let parsed: ReturnType<typeof parse>
  try {
    parsed = parse(argv)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new UsageError(`${message}\nRun "orm-preflight --help" for usage.`)
  }
  const { values, positionals } = parsed

  if (values.help === true) {
    io.stdout(helpText)
    return ExitCode.Ok
  }
  if (values.version === true) {
    io.stdout(`${version}\n`)
    return ExitCode.Ok
  }

  const cwd = io.cwd ?? process.cwd()
  const overrides: ConfigOverrides = {
    orm: values.orm,
    dialect: values.dialect,
    postgresVersion: integer(values['postgres-version'], '--postgres-version'),
  }
  const [command, ...rest] = positionals

  if (command === 'rules') {
    if (rest.length > 0) throw new UsageError('"rules" takes no arguments.')
    io.stdout(formatRules())
    return ExitCode.Ok
  }
  if (command === 'explain') {
    const [ruleId, ...extra] = rest
    if (ruleId === undefined || extra.length > 0) {
      throw new UsageError('Usage: orm-preflight explain <rule>')
    }
    io.stdout(explain(ruleId))
    return ExitCode.Ok
  }
  if (command === 'init') {
    io.stdout(await init(cwd, rest, overrides))
    return ExitCode.Ok
  }

  const format = values.format ?? 'pretty'
  if (!(FORMATS as readonly string[]).includes(format)) {
    throw new UsageError(`Unknown format "${format}". Use ${FORMATS.join(' or ')}.`)
  }
  const maxWarnings = integer(values['max-warnings'], '--max-warnings')
  const result = await runLint(
    {
      cwd,
      patterns: positionals,
      ...(values.config === undefined ? {} : { configPath: values.config }),
      ...(values['changed-since'] === undefined ? {} : { changedSince: values['changed-since'] }),
      overrides,
    },
    { get: getAdapter },
  )

  io.stdout(
    format === 'json'
      ? formatJson(result)
      : formatPretty(result, {
          color: io.color === true && values['no-color'] !== true,
          maxWarnings,
        }),
  )
  const tooManyWarnings = maxWarnings !== undefined && result.summary.warnings > maxWarnings
  return result.summary.errors > 0 || tooManyWarnings ? ExitCode.LintFailed : ExitCode.Ok
}

function parse(argv: readonly string[]) {
  return parseArgs({ args: [...argv], options: OPTIONS, strict: true, allowPositionals: true })
}

/** A non-negative whole number given to a flag. */
function integer(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) return undefined
  if (!/^\d+$/.test(value)) throw new UsageError(`${flag} must be a whole number, got "${value}".`)
  return Number(value)
}
