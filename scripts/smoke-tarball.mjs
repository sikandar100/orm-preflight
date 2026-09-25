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
import { pathToFileURL } from 'node:url'
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

  // The SQL parsers load lazily, and PostgreSQL's is WebAssembly. Prove both module formats
  // can load and run it from the installed package. The internal entry is not exported, so
  // it is loaded by file path.
  const dist = path.join(project, 'node_modules', 'orm-preflight', 'dist')
  const probe = `
    const parse = await m.loadParser('postgres')
    const result = parse('CREATE INDEX CONCURRENTLY "i" ON "t" ("a")')
    const op = result.ok ? result.statements[0].ops[0] : undefined
    let mysql = 'loaded'
    try { await m.loadParser('mysql') } catch (e) { mysql = e.name + ': ' + e.message }
    process.stdout.write(JSON.stringify({ kind: op?.kind, concurrently: op?.concurrently, mysql }))`
  const esmProbe = `const m = await import(${JSON.stringify(pathToFileURL(path.join(dist, 'internal-sql-check.mjs')).href)});${probe}`
  const cjsProbe = `const m = require(${JSON.stringify(path.join(dist, 'internal-sql-check.cjs'))}); (async () => {${probe}})()`
  const expectedProbe = JSON.stringify({
    kind: 'create_index',
    concurrently: true,
    mysql:
      'MissingParserError: MySQL support needs the node-sql-parser package. Install it with: npm install --save-dev node-sql-parser',
  })
  /** @type {Array<[string, string[]]>} */
  const probes = [
    ['ESM', ['--input-type=module', '-e', esmProbe]],
    ['CJS', ['-e', cjsProbe]],
  ]
  for (const [label, args] of probes) {
    const out = execFileSync(process.execPath, args, { cwd: project, encoding: 'utf8' })
    check(
      `${label}: PostgreSQL parser runs, missing MySQL parser is explained`,
      out === expectedProbe,
      out,
    )
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  failures.push('setup')
} finally {
  rmSync(project, { recursive: true, force: true })
}

if (failures.length > 0) process.exit(1)
console.log('Smoke test passed.')
