import { execFile } from 'node:child_process'
import { realpathSync } from 'node:fs'
import path from 'node:path'
import { UsageError } from '../errors.js'

/** How a file differs from the merge base. Renamed files with edits count as modified. */
export type FileChange = 'added' | 'modified'

/** The files changed since the merge base with a git ref, for --changed-since. */
export interface ChangeSet {
  /** The ref as given, for messages. */
  ref: string
  /** Paths relative to the linted directory, with forward slashes. */
  files: ReadonlyMap<string, FileChange>
}

/**
 * Files added or modified since the merge base of `ref` and HEAD: committed changes,
 * uncommitted changes, and untracked files. Deleted files and exact renames are left out,
 * since there is nothing new in them to lint. git runs without a shell, and the ref can
 * never be read as an option.
 */
export async function changesSince(cwd: string, ref: string): Promise<ChangeSet> {
  if (ref === '' || ref.startsWith('-')) {
    throw new UsageError(`--changed-since needs a git ref, such as origin/main. Got "${ref}".`)
  }
  let root: string
  try {
    root = (await git(cwd, ['rev-parse', '--show-toplevel'])).trim()
  } catch (error) {
    throw new UsageError(`--changed-since needs a git repository: ${firstLine(error)}.`)
  }
  let base: string
  try {
    base = (await git(cwd, ['merge-base', '--end-of-options', ref, 'HEAD'])).trim()
  } catch (error) {
    const shallow = await git(cwd, ['rev-parse', '--is-shallow-repository']).catch(() => '')
    const hint =
      shallow.trim() === 'true'
        ? ' This clone is shallow. In GitHub Actions, set fetch-depth: 0 on actions/checkout.'
        : ''
    throw new UsageError(
      `Could not find the merge base of "${ref}" and HEAD: ${firstLine(error)}.${hint}`,
    )
  }

  const files = new Map<string, FileChange>()
  const diff = await git(cwd, ['diff', '--name-status', '-z', '-M', '--end-of-options', base])
  const fields = diff.split('\0').filter((f) => f !== '')
  for (let i = 0; i < fields.length; i++) {
    const status = fields[i] ?? ''
    const letter = status.charAt(0)
    // Renames and copies are followed by two paths: the old one, then the new one.
    const file = letter === 'R' || letter === 'C' ? fields[(i += 2)] : fields[++i]
    if (file === undefined || letter === 'D') continue
    if (letter === 'R' && status === 'R100') continue
    files.set(file, letter === 'A' || letter === 'C' ? 'added' : 'modified')
  }
  const untracked = await git(cwd, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
    '--full-name',
  ])
  for (const file of untracked.split('\0')) if (file !== '') files.set(file, 'added')

  // git reports paths from the repository root; the linter works relative to cwd.
  const here = realpathSync(cwd)
  const relative = new Map<string, FileChange>()
  for (const [file, change] of files) {
    const rel = path.relative(here, path.join(root, file)).split(path.sep).join('/')
    if (!rel.startsWith('../') && rel !== '..') relative.set(rel, change)
  }
  return { ref, files: relative }
}

function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) reject(new Error(stderr.trim() || error.message))
        else resolve(stdout)
      },
    )
  })
}

function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return (message.split('\n')[0] ?? message).replace(/\.$/, '')
}
