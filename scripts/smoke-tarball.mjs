#!/usr/bin/env node
// Installs orm-preflight into a clean temporary project, exactly as a user would, and checks
// that the CLI, require() and import() all work. Zero dependencies, so it runs on bare Node 20.
// Usage:
//   node scripts/smoke-tarball.mjs --tarball <path.tgz>
//   node scripts/smoke-tarball.mjs --registry <url> --version <version>
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    tarball: { type: 'string' },
    registry: { type: 'string' },
    version: { type: 'string' },
  },
})

if ((values.tarball === undefined) === (values.registry === undefined)) {
  console.error('Pass either --tarball <path> or --registry <url> --version <version>.')
  process.exit(2)
}

const project = mkdtempSync(path.join(tmpdir(), 'orm-preflight-smoke-'))
/** @type {string[]} */
const failures = []

/**
 * Runs npm through a shell, because npm is a .cmd shim on Windows. Arguments contain no spaces.
 * @param {string[]} args
 */
function npm(args) {
  const result = spawnSync(`npm ${args.join(' ')}`, { cwd: project, encoding: 'utf8', shell: true })
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() }
}

/**
 * @param {string} name
 * @param {boolean} ok
 * @param {string} detail
 */
function check(name, ok, detail) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: ${detail}`}`)
  if (!ok) failures.push(name)
}

try {
  writeFileSync(
    path.join(project, 'package.json'),
    JSON.stringify({ name: 'smoke', version: '1.0.0', private: true }),
  )

  let spec
  const installArgs = ['install', '--no-audit', '--no-fund', '--ignore-scripts']
  if (values.tarball !== undefined) {
    copyFileSync(path.resolve(values.tarball), path.join(project, 'orm-preflight.tgz'))
    spec = './orm-preflight.tgz'
  } else {
    if (values.version === undefined) throw new Error('--registry needs --version')
    spec = `orm-preflight@${values.version}`
    installArgs.push(`--registry=${values.registry}`)
  }

  const install = npm([...installArgs, spec])
  if (install.status !== 0) throw new Error(`npm install failed:\n${install.stderr}`)

  const manifestPath = path.join(project, 'node_modules', 'orm-preflight', 'package.json')
  const expected = JSON.parse(readFileSync(manifestPath, 'utf8')).version
  console.log(`Node ${process.version}, orm-preflight ${expected}, from ${spec}`)

  const version = npm(['exec', '--no', '--', 'orm-preflight', '--version'])
  check(
    'bin prints its version',
    version.status === 0 && version.stdout === expected,
    JSON.stringify(version),
  )

  const bogus = npm(['exec', '--no', '--', 'orm-preflight', '--bogus'])
  check('bin exits 2 on an unknown option', bogus.status === 2, JSON.stringify(bogus))

  const required = execFileSync(
    process.execPath,
    ['-e', 'process.stdout.write(require("orm-preflight").version)'],
    { cwd: project, encoding: 'utf8' },
  )
  check('require() loads the CJS build', required === expected, required)

  const imported = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      'const m = await import("orm-preflight"); process.stdout.write(m.version)',
    ],
    { cwd: project, encoding: 'utf8' },
  )
  check('import() loads the ESM build', imported === expected, imported)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  failures.push('setup')
} finally {
  rmSync(project, { recursive: true, force: true })
}

if (failures.length > 0) process.exit(1)
console.log('Smoke test passed.')
