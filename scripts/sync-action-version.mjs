#!/usr/bin/env node
// Sets the default "version" input of action.yml to the version in package.json, so the
// action at tag vX.Y.Z runs orm-preflight X.Y.Z. The release workflow runs this right after
// `changeset version`, so the Version PR carries both changes.
// Usage: node scripts/sync-action-version.mjs [--check]   (--check only verifies, exit 1 if out of sync)
import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
const file = new URL('action.yml', root)
const text = readFileSync(file, 'utf8')

// The version input is the last input; its default is the only line after the marker comment.
const pattern =
  /(# Kept equal to package\.json by scripts\/sync-action-version\.mjs[^\n]*\n\s*default: ')([^']*)(')/
const match = pattern.exec(text)
if (match === null) {
  console.error('action.yml: the version default was not found next to its marker comment.')
  process.exit(2)
}
if (match[2] === version) {
  console.log(`action.yml already runs orm-preflight ${version}.`)
  process.exit(0)
}
if (process.argv.includes('--check')) {
  console.error(`action.yml runs orm-preflight ${match[2]}, but package.json is ${version}.`)
  process.exit(1)
}
writeFileSync(file, text.replace(pattern, `$1${version}$3`))
console.log(`action.yml now runs orm-preflight ${version}.`)
