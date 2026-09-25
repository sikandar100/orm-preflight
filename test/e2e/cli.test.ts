import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../../', import.meta.url))
const cli = fileURLToPath(new URL('../../dist/cli.mjs', import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  version: string
}

const project = fileURLToPath(new URL('fixtures/project/', import.meta.url))
// Color settings come from each test, never from the environment running the tests.
const inherited = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => key !== 'FORCE_COLOR' && key !== 'NO_COLOR'),
)

function spawnCli(...args: string[]) {
  return spawnIn(root, args)
}

function spawnIn(cwd: string, args: string[], env: Record<string, string> = { NO_COLOR: '1' }) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...inherited, ...env },
  })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

describe('built CLI', () => {
  it('prints the package version and exits 0', () => {
    expect(spawnCli('--version')).toEqual({ status: 0, stdout: `${pkg.version}\n`, stderr: '' })
  })

  it('prints help and exits 0', () => {
    const result = spawnCli('--help')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Usage: orm-preflight')
  })

  it('exits 2 on an unknown option', () => {
    const result = spawnCli('--bogus')
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('--bogus')
  })

  it('starts with a node shebang', () => {
    expect(readFileSync(cli, 'utf8').startsWith('#!/usr/bin/env node\n')).toBe(true)
  })
})

describe('built CLI on a sample project', () => {
  it('prints findings and exits 1 when there are errors', async () => {
    const result = spawnIn(project, [])
    expect(result.status).toBe(1)
    expect(result.stderr).toBe('')
    await expect(result.stdout).toMatchFileSnapshot('output/pretty.txt')
  })

  it('prints the JSON format, including suppressed findings', async () => {
    const result = spawnIn(project, ['--format', 'json'])
    expect(result.status).toBe(1)
    const output = result.stdout.replace(`"version": "${pkg.version}"`, '"version": "<version>"')
    await expect(output).toMatchFileSnapshot('output/findings.json')
  })

  it('exits 0 when the given files are safe', () => {
    const result = spawnIn(project, ['src/migrations/1727200000000-AddEmailIndex.ts'])
    expect(result).toEqual({
      status: 0,
      stdout: '0 errors, 0 warnings in 1 migration\n',
      stderr: '',
    })
  })

  it('exits 2 on a config error', () => {
    const result = spawnIn(project, ['-c', 'missing.json'])
    expect(result.status).toBe(2)
    expect(result.stderr).toBe('orm-preflight: Config file not found: missing.json\n')
  })

  it('uses colors when FORCE_COLOR is set', () => {
    const result = spawnIn(project, [], { FORCE_COLOR: '1' })
    expect(result.stdout).toContain(`${String.fromCharCode(27)}[`)
  })

  it('lists the rules and explains one', () => {
    expect(spawnIn(project, ['rules']).stdout).toContain('typeorm/invalid-migration-name')
    const explained = spawnIn(project, ['explain', 'no-set-not-null'])
    expect(explained.status).toBe(0)
    expect(explained.stdout).toBe(
      readFileSync(new URL('../../docs/rules/no-set-not-null.md', import.meta.url), 'utf8'),
    )
  })

  it('writes a starter config with init', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'orm-preflight-init-'))
    try {
      cpSync(path.join(project, 'src'), path.join(dir, 'src'), { recursive: true })
      const result = spawnIn(dir, ['init'])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('startAfter is 1727300000000')
      const lint = spawnIn(dir, [])
      expect(lint).toEqual({
        status: 0,
        stdout: '0 errors, 0 warnings in 0 migrations\n',
        stderr: '',
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('built library', () => {
  it('loads through import', async () => {
    const mod = (await import(new URL('../../dist/index.mjs', import.meta.url).href)) as {
      version: string
    }
    expect(mod.version).toBe(pkg.version)
  })

  it('loads through require', () => {
    const require = createRequire(import.meta.url)
    const mod = require('../../dist/index.cjs') as { version: string }
    expect(mod.version).toBe(pkg.version)
  })
})
