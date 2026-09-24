import { parseArgs } from 'node:util'
import { version } from '../version.js'
import { ExitCode } from './exit-codes.js'

export interface CliIo {
  stdout: (text: string) => void
  stderr: (text: string) => void
}

export const helpText = `Usage: orm-preflight [options]

Preflight safety checks for ORM migrations.

Options
  -h, --help     Print this help
  -v, --version  Print the version
`

/** Runs the CLI with the given arguments and returns the exit code. Never calls process.exit. */
export function run(argv: readonly string[], io: CliIo): ExitCode {
  let values: { help?: boolean; version?: boolean }
  try {
    ;({ values } = parseArgs({
      args: [...argv],
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
      strict: true,
      allowPositionals: false,
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    io.stderr(`orm-preflight: ${message}\nRun "orm-preflight --help" for usage.\n`)
    return ExitCode.UsageOrInternalError
  }

  if (values.version === true) {
    io.stdout(`${version}\n`)
    return ExitCode.Ok
  }

  io.stdout(helpText)
  return ExitCode.Ok
}
