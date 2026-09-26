import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../../', import.meta.url))
const project = fileURLToPath(new URL('../e2e/fixtures/project/', import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  version: string
}

describe('action.yml', () => {
  const action = readFileSync(new URL('../../action.yml', import.meta.url), 'utf8')

  it('runs the version in package.json by default', () => {
    const check = spawnSync(process.execPath, ['scripts/sync-action-version.mjs', '--check'], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(check.status, check.stderr).toBe(0)
    expect(action).toContain(`default: '${pkg.version}'`)
  })

  it('never pastes an input into a script', () => {
    // Inputs reach scripts only through env. An expression inside `run:` could inject commands.
    const runBlocks = action.split(/^\s+run: \|$/m).slice(1)
    expect(runBlocks).toHaveLength(3)
    for (const block of runBlocks) {
      const script = block.split(/^\s{4}- /m)[0] ?? ''
      expect(script).not.toMatch(/\$\{\{/)
    }
  })

  it('pins the SARIF upload action to a commit', () => {
    expect(action).toMatch(/uses: github\/codeql-action\/upload-sarif@[0-9a-f]{40} # v\d/)
  })
})

// The run script needs bash, which Windows runners only provide through Git Bash.
describe.skipIf(process.platform === 'win32')('scripts/action-run.sh', () => {
  function runAction(env: Record<string, string>) {
    const script = 'source "$ACTION_PATH/scripts/action-run.sh" && orm_preflight --format json'
    const result = spawnSync('bash', ['-c', script], {
      cwd: project,
      encoding: 'utf8',
      env: { PATH: process.env.PATH, ACTION_PATH: root, VERSION: 'local', ...env },
    })
    return { status: result.status, stdout: result.stdout, stderr: result.stderr }
  }

  it('checks the whole project by default', () => {
    const result = runAction({})
    expect(result.status).toBe(1)
    expect(
      (JSON.parse(result.stdout) as { summary: { migrations: number } }).summary.migrations,
    ).toBe(3)
  })

  it('passes files as separate arguments and leaves globs to orm-preflight', () => {
    const result = runAction({
      FILES: 'src/migrations/1727200000000-AddEmailIndex.ts  src/migrations/*-DropBio.ts',
    })
    expect(result.status).toBe(0)
    const output = JSON.parse(result.stdout) as { summary: { files: number } }
    expect(output.summary.files).toBe(2)
  })

  it('passes the config path', () => {
    const result = runAction({ CONFIG: 'missing.json' })
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('Config file not found: missing.json')
  })

  it('passes changed-since, and a hostile ref stays one argument', () => {
    const marker = path.join(tmpdir(), `orm-preflight-pwned-${String(process.pid)}`)
    const result = runAction({ CHANGED_SINCE: `$(touch ${marker}) --help` })
    expect(existsSync(marker)).toBe(false)
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(`Could not find the merge base of "$(touch ${marker}) --help"`)
  })
})
