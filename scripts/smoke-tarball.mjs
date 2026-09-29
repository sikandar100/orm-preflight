#!/usr/bin/env node
// Installs orm-preflight into a clean temporary project, exactly as a user would, and checks
// that the CLI, require() and import() all work. Zero dependencies, so it runs on bare Node 20.
// Usage:
//   node scripts/smoke-tarball.mjs --tarball <path.tgz>
//   node scripts/smoke-tarball.mjs --registry <url> --version <version>
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

  // A real run from the installed package: a migration that drops a table must fail with
  // exit code 1, and the embedded rule docs must be there for explain.
  mkdirSync(path.join(project, 'migrations'))
  writeFileSync(
    path.join(project, 'migrations', '1727000000000-Drop.ts'),
    'export class Drop1727000000000 {\n  async up(queryRunner) {\n    await queryRunner.query(`DROP TABLE "users"`)\n  }\n\n  async down() {\n    throw new Error(\'irreversible\')\n  }\n}\n',
  )
  const linted = npm(['exec', '--no', '--', 'orm-preflight', '--format', 'json'])
  const output = linted.stdout === '' ? { findings: [], summary: {} } : JSON.parse(linted.stdout)
  // Check for the finding, not the total, so adding a rule does not break this test.
  check(
    'bin lints a migration and exits 1 on an error',
    linted.status === 1 &&
      output.summary.errors === 1 &&
      output.findings.some((/** @type {{ ruleId: string }} */ f) => f.ruleId === 'no-drop-table'),
    JSON.stringify(linted),
  )
  const explained = npm(['exec', '--no', '--', 'orm-preflight', 'explain', 'no-drop-table'])
  check(
    'bin explains a rule from the embedded docs',
    explained.status === 0 && explained.stdout.startsWith('# no-drop-table'),
    JSON.stringify(explained),
  )

  // node-sql-parser is not installed here, so MySQL must fail with a plain message, not a crash.
  const noParser = npm(['exec', '--no', '--', 'orm-preflight', '--dialect', 'mysql'])
  check(
    'bin explains a missing MySQL parser and exits 2',
    noParser.status === 2 &&
      noParser.stderr.includes('npm install --save-dev node-sql-parser') &&
      !noParser.stderr.includes('internal error'),
    JSON.stringify(noParser),
  )

  // The MCP server from the installed package, over stdio, the way an AI agent starts it.
  const mcpInput = [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'smoke', version: '0' },
      },
    },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'check_migrations', arguments: { files: ['migrations/*.ts'] } },
    },
  ]
    .map((message) => `${JSON.stringify(message)}\n`)
    .join('')
  const mcp = spawnSync('npm exec --no -- orm-preflight mcp', {
    cwd: project,
    encoding: 'utf8',
    shell: true,
    input: mcpInput,
  })
  let replies = []
  try {
    replies = mcp.stdout
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line))
  } catch {
    // Anything on stdout that is not an MCP message fails the check below.
  }
  const initialized = replies.find((/** @type {{ id: number }} */ r) => r.id === 1)
  const called = replies.find((/** @type {{ id: number }} */ r) => r.id === 2)
  check(
    'bin mcp answers an MCP client over stdio',
    mcp.status === 0 &&
      replies.length === 2 &&
      initialized?.result?.serverInfo?.version === expected &&
      called?.result?.structuredContent?.findings?.some(
        (/** @type {{ ruleId: string }} */ f) => f.ruleId === 'no-drop-table',
      ) === true,
    JSON.stringify(mcp),
  )

  // --execute loads the typeorm stand-in shipped in dist. A migration whose SQL is only known
  // at run time proves it works from the installed package, in ESM (the bin) and CJS (require).
  mkdirSync(path.join(project, 'dynamic'))
  writeFileSync(
    path.join(project, 'dynamic', '1727000000001-Dynamic.ts'),
    "import { MigrationInterface, QueryRunner } from 'typeorm'\n\nexport class Dynamic1727000000001 implements MigrationInterface {\n  async up(queryRunner: QueryRunner) {\n    const table = ['us', 'ers'].join('')\n    await queryRunner.query(`DROP TABLE \"${table}\"`)\n  }\n\n  async down() {\n    throw new Error('irreversible')\n  }\n}\n",
  )
  const executed = npm([
    'exec',
    '--no',
    '--',
    'orm-preflight',
    '--execute',
    '--format',
    'json',
    'dynamic/*.ts',
  ])
  const executedFindings = executed.stdout === '' ? [] : JSON.parse(executed.stdout).findings
  check(
    'bin --execute runs a TypeScript migration and sees its run-time SQL',
    executed.status === 1 &&
      executedFindings.some((/** @type {{ ruleId: string }} */ f) => f.ruleId === 'no-drop-table'),
    JSON.stringify(executed),
  )
  const requiredExecute = execFileSync(
    process.execPath,
    [
      '-e',
      "require('orm-preflight').lint({ execute: true, patterns: ['dynamic/*.ts'] }).then((r) => process.stdout.write(r.findings.map((f) => f.ruleId).join(',')))",
    ],
    { cwd: project, encoding: 'utf8' },
  )
  check(
    'require() --execute (CJS build) finds the typeorm stand-in',
    requiredExecute.split(',').includes('no-drop-table'),
    requiredExecute,
  )

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
