#!/usr/bin/env node
// Runs orm-preflight for the Claude Code plugin. No dependencies, so it runs on a bare Node.js.
//
// By default it runs exactly the package version below, through npm's npx script, started
// with this Node.js and no shell. The version is pinned, so what runs is the code that was
// reviewed. The first run downloads it from npm.
//
// The MCP server always runs the pinned package. Only the hook can run the copy installed in
// the project folder itself (node_modules/orm-preflight, never one in a parent folder), and
// only when the user turns on the plugin setting "Use the project's own orm-preflight"
// (use_project_install, off by default). Claude Code passes that setting to hooks as
// CLAUDE_PLUGIN_OPTION_USE_PROJECT_INSTALL; the MCP server never receives it.
//
// Environment variables it reads: CLAUDE_PROJECT_DIR, the project Claude Code opened, and
// CLAUDE_PLUGIN_OPTION_USE_PROJECT_INSTALL.
//
// Run directly, it passes its arguments on and shares stdin and stdout, which the MCP server
// needs: node orm-preflight.mjs mcp
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The exact package this plugin runs. Kept equal to package.json by scripts/sync-action-version.mjs.
export const PACKAGE = 'orm-preflight@1.2.0'

/**
 * Whether the user turned on "Use the project's own orm-preflight". Only an explicit true
 * counts; anything else, including an unset value, keeps the pinned package.
 * @param {string | undefined} value
 */
export function settingOn(value) {
  return value !== undefined && ['true', '1'].includes(value.trim().toLowerCase())
}

/** The setting as Claude Code passes it to hooks. Unset everywhere else, so off. */
export function useProjectInstall() {
  return settingOn(process.env.CLAUDE_PLUGIN_OPTION_USE_PROJECT_INSTALL)
}

/**
 * @typedef {{ command: string, args: string[] } | { error: string }} Resolved
 */

/**
 * The command that runs orm-preflight for a project, or why it cannot run. Never uses a shell.
 * @param {string} projectDir
 * @param {readonly string[]} args
 * @param {{ useProjectInstall?: boolean, node?: string }} [options] `node` is the Node.js
 *   binary whose npm is used, by default the one running this script.
 * @returns {Resolved}
 */
export function resolveCommand(projectDir, args, options = {}) {
  const node = options.node ?? process.execPath
  if (options.useProjectInstall === true) {
    const local = projectInstall(projectDir)
    // The MCP server needs 1.1.0 or newer; an older copy still serves the hook.
    if (local !== undefined && (args[0] !== 'mcp' || atLeast(local.version, 1, 1))) {
      return { command: node, args: [local.cli, ...args] }
    }
  }
  const npxCli = findNpxCli(node)
  if (npxCli === undefined) {
    return {
      error: `npm's npx script was not found next to Node.js (${node}), so ${PACKAGE} cannot be started. Install Node.js together with npm.`,
    }
  }
  return { command: node, args: [npxCli, '-y', PACKAGE, ...args] }
}

/**
 * The orm-preflight installed in the project folder itself. Never looks in a parent folder.
 * @param {string} dir
 * @returns {{ cli: string, version: string } | undefined}
 */
function projectInstall(dir) {
  const root = path.join(path.resolve(dir), 'node_modules', 'orm-preflight')
  const pkg = path.join(root, 'package.json')
  const cli = path.join(root, 'dist', 'cli.mjs')
  if (!existsSync(pkg) || !existsSync(cli)) return undefined
  const { version } = /** @type {{ version: string }} */ (JSON.parse(readFileSync(pkg, 'utf8')))
  return { cli, version }
}

/**
 * npm's npx script, which ships next to Node.js in every standard install.
 * @param {string} node
 */
function findNpxCli(node) {
  const bin = path.dirname(node)
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

/**
 * Runs orm-preflight and captures its output. When it cannot start, the result says why.
 * @param {string} projectDir
 * @param {readonly string[]} args
 * @param {{ useProjectInstall?: boolean }} [options]
 */
export function runCaptured(projectDir, args, options = {}) {
  const resolved = resolveCommand(projectDir, args, options)
  if ('error' in resolved) {
    return { status: null, stdout: '', stderr: '', error: new Error(resolved.error) }
  }
  return spawnSync(resolved.command, resolved.args, {
    cwd: projectDir,
    encoding: 'utf8',
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
  const resolved = resolveCommand(projectDir, process.argv.slice(2), {
    useProjectInstall: useProjectInstall(),
  })
  if ('error' in resolved) {
    process.stderr.write(`orm-preflight plugin: ${resolved.error}\n`)
    process.exitCode = 2
  } else {
    const child = spawn(resolved.command, resolved.args, {
      cwd: projectDir,
      stdio: 'inherit',
      windowsHide: true,
    })
    child.on('exit', (code) => {
      process.exitCode = code ?? 1
    })
    child.on('error', (error) => {
      process.stderr.write(
        `orm-preflight plugin: could not start orm-preflight: ${error.message}\n`,
      )
      process.exitCode = 2
    })
  }
}
