#!/usr/bin/env node
// Claude Code PostToolUse hook: after Claude writes or edits a migration, check it with
// orm-preflight and hand the findings back to Claude. Other files are skipped at once.
//
// Input: the hook event as JSON on stdin. Output: nothing when there is nothing to say, or
// one line of JSON with hookSpecificOutput.additionalContext, which Claude reads. It never
// blocks the edit and always exits 0, so a problem in the check never gets in Claude's way.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCaptured } from './orm-preflight.mjs'

const MIGRATION_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.cjs', '.mts', '.cts'])

/**
 * Whether a file looks like an ORM migration: a TypeScript or JavaScript file in a folder
 * named like "migrations", or one with an up(queryRunner) method.
 * @param {string} file
 * @param {string} text
 */
export function looksLikeMigration(file, text) {
  if (!MIGRATION_EXTENSIONS.has(path.extname(file)) || file.endsWith('.d.ts')) return false
  const folders = path.dirname(file).split(/[\\/]/)
  if (folders.some((folder) => /migration/i.test(folder))) return true
  return /\bup\s*\(\s*queryRunner\b/.test(text)
}

/**
 * The directory to run orm-preflight in: the nearest one above the file with an
 * orm-preflight config or a package.json, but not above the project.
 * @param {string} file
 * @param {string} projectDir
 */
export function projectDirFor(file, projectDir) {
  const root = path.resolve(projectDir)
  for (let dir = path.dirname(file); ; dir = path.dirname(dir)) {
    if (
      existsSync(path.join(dir, 'orm-preflight.config.json')) ||
      existsSync(path.join(dir, 'package.json'))
    ) {
      return dir
    }
    if (dir === root || path.dirname(dir) === dir || !dir.startsWith(root)) return root
  }
}

/**
 * Whether the file's 13-digit timestamp is at or before the startAfter of the config in dir.
 * @param {string} file
 * @param {string} dir
 */
export function isBeforeStartAfter(file, dir) {
  const timestamp = /(\d{13})/.exec(path.basename(file))?.[1]
  if (timestamp === undefined) return false
  let startAfter
  try {
    const configFile = path.join(dir, 'orm-preflight.config.json')
    if (existsSync(configFile)) {
      startAfter = JSON.parse(readFileSync(configFile, 'utf8')).startAfter
    } else {
      startAfter = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).ormPreflight
        ?.startAfter
    }
  } catch {
    return false
  }
  return typeof startAfter === 'number' && Number(timestamp) <= startAfter
}

/**
 * @typedef {{ ruleId: string, severity: string, file: string, line: number, message: string,
 *   why: string, safeAlternative: string | null, docsUrl: string, suppressed: unknown }} Finding
 */

/**
 * The text Claude reads, also when there are no problems, so Claude knows the check ran.
 * Undefined when the file turned out not to hold a migration.
 * @param {string} shownPath
 * @param {{ status: number | null, stdout: string, stderr: string, error?: Error }} run
 * @param {boolean} [beforeStartAfter] The file's timestamp is at or before the config's startAfter.
 */
export function feedback(shownPath, run, beforeStartAfter = false) {
  if (run.status === 0 || run.status === 1) {
    /** @type {{ summary?: { migrations?: number }, findings: Finding[] }} */
    let output
    try {
      output = JSON.parse(run.stdout)
    } catch {
      return undefined
    }
    const open = output.findings.filter((f) => f.suppressed === null)
    if (open.length === 0) {
      if (output.summary?.migrations !== 0) {
        return `orm-preflight checked the migration ${shownPath}: no problems found.`
      }
      if (!beforeStartAfter) return undefined
      return `orm-preflight did not check the migration ${shownPath}: it is not after "startAfter" in the orm-preflight config, so it counts as a migration that already ran. Editing a migration that already ran does not change databases where it ran.`
    }
    const lines = [
      `orm-preflight found ${String(open.length)} ${open.length === 1 ? 'problem' : 'problems'} in the migration ${shownPath}:`,
      '',
    ]
    for (const f of open) {
      lines.push(`- Line ${String(f.line)}, ${f.ruleId} (${f.severity}): ${f.message}`)
      lines.push(`  Why: ${f.why}`)
      if (f.safeAlternative !== null) lines.push(`  Safe way: ${f.safeAlternative}`)
      lines.push(`  Docs: ${f.docsUrl}`)
    }
    lines.push(
      '',
      'Fix the migration using the safe way above, or explain to the user why it is safe here.',
      'Do not add a "preflight safety-assured" comment to silence a finding unless the user agrees, and then write their reason in it.',
    )
    return lines.join('\n')
  }
  // Exit code 2, or orm-preflight did not start: say so briefly, once.
  const reason =
    run.error?.message ?? run.stderr.split('\n').find((line) => line.trim() !== '') ?? 'unknown'
  return `orm-preflight could not check the migration ${shownPath}: ${reason.replace(/^orm-preflight: /, '')}`
}

/**
 * Handles one hook event and returns what to print, or undefined.
 * @param {unknown} event
 * @param {(dir: string, args: string[]) => { status: number | null, stdout: string | null, stderr: string | null, error?: Error | undefined }} run
 */
export function handle(event, run = runCaptured) {
  const input = /** @type {{ cwd?: unknown, tool_input?: { file_path?: unknown } }} */ (event)
  const filePath = input.tool_input?.file_path
  if (typeof filePath !== 'string') return undefined
  const projectRoot =
    process.env.CLAUDE_PROJECT_DIR ?? (typeof input.cwd === 'string' ? input.cwd : process.cwd())
  const file = path.resolve(projectRoot, filePath)
  if (!existsSync(file)) return undefined
  const text = readFileSync(file, 'utf8')
  if (!looksLikeMigration(file, text)) return undefined

  const dir = projectDirFor(file, projectRoot)
  const relative = path.relative(dir, file).split(path.sep).join('/')
  const result = run(dir, ['--format', 'json', relative])
  // When orm-preflight could not start at all, Node leaves the output null.
  const context = feedback(
    path.relative(projectRoot, file).split(path.sep).join('/'),
    {
      status: result.status,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      ...(result.error === undefined ? {} : { error: result.error }),
    },
    isBeforeStartAfter(file, dir),
  )
  if (context === undefined) return undefined
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: context },
  })
}

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let raw = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => (raw += chunk))
  process.stdin.on('end', () => {
    try {
      const output = handle(JSON.parse(raw))
      if (output !== undefined) process.stdout.write(`${output}\n`)
    } catch (error) {
      // Never break Claude's work over a problem in the check itself.
      process.stderr.write(
        `orm-preflight hook: ${error instanceof Error ? error.message : String(error)}\n`,
      )
    }
  })
}
