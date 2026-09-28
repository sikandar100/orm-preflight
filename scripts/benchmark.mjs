#!/usr/bin/env node
// Performance budget (SPEC 8.6): static mode lints 1,000 migration files in under 10 seconds.
// Builds 1,000 files from the golden migrations (real TypeORM output), each with its own
// timestamp and class name, then times the built CLI on them.
// Usage: node scripts/benchmark.mjs [--files 1000] [--budget 10]
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    files: { type: 'string', default: '1000' },
    budget: { type: 'string', default: '10' },
  },
})
const count = Number(values.files)
const budget = Number(values.budget)

const root = fileURLToPath(new URL('../', import.meta.url))
const golden = path.join(root, 'test/golden/typeorm-0.3.31/postgres')
const sources = readdirSync(golden)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => readFileSync(path.join(golden, f), 'utf8'))

const project = mkdtempSync(path.join(tmpdir(), 'orm-preflight-bench-'))
try {
  const dir = path.join(project, 'src', 'migrations')
  mkdirSync(dir, { recursive: true })
  for (let i = 0; i < count; i++) {
    const timestamp = 1700000000000 + i
    const text = (sources[i % sources.length] ?? '')
      .replace(/class (\w+?)\d{13}/, `class $1${String(timestamp)}`)
      .replace(/name = '(\w+?)\d{13}'/, `name = '$1${String(timestamp)}'`)
    writeFileSync(path.join(dir, `${String(timestamp)}-Bench${String(i)}.ts`), text)
  }

  const started = performance.now()
  let output = ''
  try {
    output = execFileSync(process.execPath, [path.join(root, 'dist/cli.mjs'), '--format', 'json'], {
      cwd: project,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    })
  } catch (error) {
    // Exit code 1 only means findings, which these migrations have.
    const failed = /** @type {{ status?: number, stdout?: string }} */ (error)
    if (failed.status !== 1 || failed.stdout === undefined) throw error
    output = failed.stdout
  }
  const seconds = (performance.now() - started) / 1000
  const { summary } = JSON.parse(output)

  console.log(
    `Linted ${String(summary.files)} files (${String(summary.migrations)} migrations, ` +
      `${String(summary.errors + summary.warnings)} findings) in ${seconds.toFixed(2)} s. ` +
      `Budget: ${String(budget)} s.`,
  )
  if (summary.files !== count)
    throw new Error(`Expected ${String(count)} files, got ${String(summary.files)}.`)
  if (seconds > budget) {
    console.error(
      `::error::Too slow: ${seconds.toFixed(2)} s is over the ${String(budget)} s budget.`,
    )
    process.exitCode = 1
  }
} finally {
  rmSync(project, { recursive: true, force: true })
}
