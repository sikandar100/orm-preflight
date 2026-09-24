import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../../', import.meta.url))
const cli = fileURLToPath(new URL('../../dist/cli.mjs', import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  version: string
}

function spawnCli(...args: string[]) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' })
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
