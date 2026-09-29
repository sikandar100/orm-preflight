#!/usr/bin/env node
// Sets the default "version" input of action.yml, the version of the Claude Code plugin, and
// the versions in server.json (the MCP Registry listing) to the version in package.json. So the action at tag vX.Y.Z runs orm-preflight X.Y.Z, and
// the plugin runs the same version through npx. The release workflow runs this right after
// `changeset version`, so the Version PR carries all of these changes.
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
const check = process.argv.includes('--check')
let outOfSync = false

if (match[2] === version) {
  console.log(`action.yml already runs orm-preflight ${version}.`)
} else if (check) {
  console.error(`action.yml runs orm-preflight ${match[2]}, but package.json is ${version}.`)
  outOfSync = true
} else {
  writeFileSync(file, text.replace(pattern, `$1${version}$3`))
  console.log(`action.yml now runs orm-preflight ${version}.`)
}

const pluginFile = new URL('plugins/orm-preflight/.claude-plugin/plugin.json', root)
const pluginText = readFileSync(pluginFile, 'utf8')
const plugin = JSON.parse(pluginText)
if (plugin.version === version) {
  console.log(`The Claude Code plugin is already version ${version}.`)
} else if (check) {
  console.error(
    `The Claude Code plugin is version ${plugin.version}, but package.json is ${version}.`,
  )
  outOfSync = true
} else {
  // Replace only the version line, so the file keeps its formatting.
  writeFileSync(pluginFile, pluginText.replace(/("version": ")[^"]*(")/, `$1${version}$2`))
  console.log(`The Claude Code plugin is now version ${version}.`)
}
// The MCP Registry listing names the version twice: the server and its npm package.
const serverFile = new URL('server.json', root)
const serverText = readFileSync(serverFile, 'utf8')
const server = JSON.parse(serverText)
if (server.version === version && server.packages[0].version === version) {
  console.log(`server.json is already version ${version}.`)
} else if (check) {
  console.error(`server.json is version ${server.version}, but package.json is ${version}.`)
  outOfSync = true
} else {
  writeFileSync(serverFile, serverText.replaceAll(/("version": ")[^"]*(")/g, `$1${version}$2`))
  console.log(`server.json is now version ${version}.`)
}

if (outOfSync) process.exit(1)
