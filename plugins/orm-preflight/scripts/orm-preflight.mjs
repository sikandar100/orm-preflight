#!/usr/bin/env node
// Runs orm-preflight for the Claude Code plugin. No dependencies, so it runs on a bare Node.js.
//
// Which orm-preflight runs, in order:
// 1. The project's own install, so its config and version apply. For `mcp` it must be 1.1.0
//    or newer, the first version with the MCP server.
// 2. The version of this plugin, through npx.
//
// The only environment variable it reads is CLAUDE_PROJECT_DIR, the project Claude Code opened.
//
// Run directly, it passes its arguments on and shares stdin and stdout, which the MCP server
// needs: node orm-preflight.mjs mcp
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginRoot = fileURLToPath(new URL('../', import.meta.url))

/** The orm-preflight version this plugin was released with. */
export function pluginVersion() {
  const manifest = path.join(pluginRoot, '.claude-plugin', 'plugin.json')
  return /** @type {{ version: string }} */ (JSON.parse(readFileSync(manifest, 'utf8'))).version
}

/**
 * The command that runs orm-preflight for a project.
 * @param {string} projectDir
 * @param {readonly string[]} args
 * @returns {{ command: string, args: string[], shell: boolean }}
 */
export function resolveCommand(projectDir, args) {
  const local = findInstalled(projectDir)
  if (local !== undefined && (args[0] !== 'mcp' || atLeast(local.version, 1, 1))) {
    return { command: process.execPath, args: [local.cli, ...args], shell: false }
  }
  const npxArgs = ['-y', `orm-preflight@${pluginVersion()}`, ...args]
  // Run npm's npx script with this Node, so no shell parses the arguments.
  const npxCli = findNpxCli()
  if (npxCli !== undefined) {
    return { command: process.execPath, args: [npxCli, ...npxArgs], shell: false }
  }
  // Last resort: npx through a shell (npx is a .cmd file on Windows), with quoted arguments.
  return { command: 'npx', args: npxArgs.map(quote), shell: true }
}

/**
 * The nearest orm-preflight install in the project or a parent directory.
 * @param {string} dir
 * @returns {{ cli: string, version: string } | undefined}
 */
function findInstalled(dir) {
  for (let current = path.resolve(dir); ; current = path.dirname(current)) {
    const pkg = path.join(current, 'node_modules', 'orm-preflight', 'package.json')
    const cli = path.join(current, 'node_modules', 'orm-preflight', 'dist', 'cli.mjs')
    if (existsSync(pkg) && existsSync(cli)) {
      const { version } = /** @type {{ version: string }} */ (JSON.parse(readFileSync(pkg, 'utf8')))
      return { cli, version }
    }
    if (path.dirname(current) === current) return undefined
  }
}

/** npm's npx script, which ships next to Node.js in every standard install. */
function findNpxCli() {
  const bin = path.dirname(process.execPath)
  const candidates = [
    path.join(bin, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    path.join(bin, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
  ]
  return candidates.find((file) => existsSync(file))
}

/**
 * @param {string} version
 * @param {number} major
 * @param {number} minor
 */
function atLeast(version, major, minor) {
  const [a = 0, b = 0] = version.split('.').map(Number)
  return a > major || (a === major && b >= minor)
}

/** @param {string} arg */
function quote(arg) {
  return `"${arg.replaceAll('"', '\\"')}"`
}

/**
 * Runs orm-preflight and captures its output.
 * @param {string} projectDir
 * @param {readonly string[]} args
 */
export function runCaptured(projectDir, args) {
  const { command, args: fullArgs, shell } = resolveCommand(projectDir, args)
  return spawnSync(command, fullArgs, {
    cwd: projectDir,
    encoding: 'utf8',
    shell,
    timeout: 50_000,
    windowsHide: true,
  })
}

// Run directly: pass everything through, including stdin and stdout for the MCP server.
if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
  const { command, args, shell } = resolveCommand(projectDir, process.argv.slice(2))
  const child = spawn(command, args, {
    cwd: projectDir,
    stdio: 'inherit',
    shell,
    windowsHide: true,
  })
  child.on('exit', (code) => {
    process.exitCode = code ?? 1
  })
  child.on('error', (error) => {
    process.stderr.write(`orm-preflight plugin: could not start orm-preflight: ${error.message}\n`)
    process.exitCode = 2
  })
}
