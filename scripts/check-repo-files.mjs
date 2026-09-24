#!/usr/bin/env node
// Fails when a file that must never be committed is staged or tracked.
// Usage:
//   node scripts/check-repo-files.mjs <file...>   check the given paths (pre-commit hook)
//   node scripts/check-repo-files.mjs --tracked   check every file tracked by git (CI)
import { execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'

const MAX_BYTES = 500 * 1024
const SIZE_EXEMPT = new Set(['pnpm-lock.yaml'])

/** @type {Array<[RegExp, string]>} */
const FORBIDDEN = [
  [/^docs\/SPEC\.md$/, 'the maintainer spec is local only'],
  [/(^|\/)\.env(\..*)?$/, 'environment files can hold secrets'],
  [/(^|\/)\.npmrc$/, 'npm config can hold auth tokens'],
  [/\.(pem|key|p12|pfx)$/, 'private keys and certificates'],
  [/\.tgz$/, 'package tarballs are build output'],
  [/^(dist|coverage)\//, 'build and coverage output'],
  [/(^|\/)node_modules\//, 'installed dependencies'],
  [/^\.claude\/settings\.local\.json$/, 'personal assistant settings'],
]

const args = process.argv.slice(2)
const files =
  args[0] === '--tracked'
    ? execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
    : args

const problems = []
for (const raw of files) {
  const file = raw.replaceAll('\\', '/')
  for (const [pattern, reason] of FORBIDDEN) {
    if (pattern.test(file)) problems.push(`${file}: must not be committed (${reason})`)
  }
  if (!SIZE_EXEMPT.has(file) && existsSync(file)) {
    const { size } = statSync(file)
    if (size > MAX_BYTES) {
      problems.push(
        `${file}: ${Math.round(size / 1024)} KB is over the ${MAX_BYTES / 1024} KB limit`,
      )
    }
  }
}

if (problems.length > 0) {
  console.error(`Blocked files:\n${problems.map((p) => `  ${p}`).join('\n')}`)
  console.error('\nUnstage them with: git restore --staged <file>')
  process.exit(1)
}
