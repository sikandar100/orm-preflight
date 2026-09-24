import { describe, expect, it } from 'vitest'
import { ExitCode } from '../../src/cli/exit-codes.js'
import { helpText, run } from '../../src/cli/run.js'
import { version } from '../../src/index.js'

function runCli(...argv: string[]) {
  let stdout = ''
  let stderr = ''
  const code = run(argv, {
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  })
  return { code, stdout, stderr }
}

describe('run', () => {
  it.each(['--version', '-v'])('prints the version for %s', (flag) => {
    expect(runCli(flag)).toEqual({ code: ExitCode.Ok, stdout: `${version}\n`, stderr: '' })
  })

  it.each([[], ['--help'], ['-h']])('prints help for %j', (...argv) => {
    expect(runCli(...argv)).toEqual({ code: ExitCode.Ok, stdout: helpText, stderr: '' })
  })

  it('exits 2 on an unknown option', () => {
    const result = runCli('--bogus')
    expect(result.code).toBe(ExitCode.UsageOrInternalError)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain("Unknown option '--bogus'")
  })

  it('exits 2 on a positional argument', () => {
    const result = runCli('migrations/*.ts')
    expect(result.code).toBe(ExitCode.UsageOrInternalError)
    expect(result.stderr).toContain('migrations/*.ts')
  })

  it('never uses em dashes in help text', () => {
    expect(helpText).not.toContain('—')
  })
})

describe('ExitCode', () => {
  it('keeps the public exit code values', () => {
    expect(ExitCode).toEqual({ Ok: 0, LintFailed: 1, UsageOrInternalError: 2 })
  })
})
