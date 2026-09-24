#!/usr/bin/env node
// Packs the package with pnpm (the tool that publishes it) and fails when the tarball
// contains a file outside the allowlist, misses a required file, or exceeds the size budget.
// Usage: node scripts/check-pack.mjs [--out <dir>]   (keeps the tarball in <dir>)
import { execFileSync, execSync } from 'node:child_process'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'

const MAX_TARBALL_BYTES = 250 * 1024

const ALLOWED = [
  /^dist\/.+\.(mjs|cjs|d\.mts|d\.cts|map)$/,
  /^schema\.json$/,
  /^action\.yml$/,
  /^README\.md$/,
  /^LICENSE$/,
  /^CHANGELOG\.md$/,
  /^package\.json$/,
]

const REQUIRED = [
  'package.json',
  'LICENSE',
  'README.md',
  'dist/cli.mjs',
  'dist/index.mjs',
  'dist/index.cjs',
  'dist/index.d.mts',
  'dist/index.d.cts',
]

const { values } = parseArgs({ options: { out: { type: 'string' } } })
const outDir =
  values.out === undefined
    ? mkdtempSync(path.join(tmpdir(), 'orm-preflight-pack-'))
    : path.resolve(values.out)

// Lifecycle scripts are skipped so their output cannot corrupt the JSON report.
const args = ['pack', '--json', '--pack-destination', outDir, '--config.ignore-scripts=true']
const stdout =
  process.platform === 'win32'
    ? // pnpm may be a .cmd shim on Windows, which needs a shell.
      execSync(`pnpm ${args.map((a) => `"${a}"`).join(' ')}`, { encoding: 'utf8' })
    : execFileSync('pnpm', args, { encoding: 'utf8' })
/** @type {{ filename: string, files: Array<{ path: string }> }} */
const report = JSON.parse(stdout)
const files = report.files.map((f) => f.path.replaceAll('\\', '/')).sort()

const problems = []
for (const file of files) {
  if (!ALLOWED.some((pattern) => pattern.test(file))) problems.push(`unexpected file: ${file}`)
}
for (const file of REQUIRED) {
  if (!files.includes(file)) problems.push(`missing required file: ${file}`)
}
const { size } = statSync(report.filename)
if (size > MAX_TARBALL_BYTES) {
  problems.push(`tarball is ${size} bytes, over the ${MAX_TARBALL_BYTES} byte budget`)
}

console.log(`Tarball: ${report.filename} (${size} bytes)`)
console.log(files.map((f) => `  ${f}`).join('\n'))
if (values.out === undefined) rmSync(outDir, { recursive: true, force: true })

if (problems.length > 0) {
  console.error(`\nPackage contents check failed:\n${problems.map((p) => `  ${p}`).join('\n')}`)
  process.exit(1)
}
console.log('\nPackage contents check passed.')
