import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { changesSince } from '../../src/discovery/git.js'
import { UsageError } from '../../src/errors.js'

let dir: string

function git(cwd: string, ...args: string[]) {
  return execFileSync(
    'git',
    [
      '-c',
      'user.name=test',
      '-c',
      'user.email=test@example.com',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

function write(file: string, text: string) {
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
  writeFileSync(path.join(dir, file), text)
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'orm-preflight-git-'))
  git(dir, 'init', '-q', '-b', 'main')
  write('db/migrations/1-Edited.ts', 'export class Edited1 {}\n')
  write('db/migrations/2-Moved.ts', 'export class Moved2 {}\n'.repeat(20))
  write('db/migrations/3-MovedAndEdited.ts', 'export class MovedAndEdited3 {}\n'.repeat(20))
  write('db/migrations/4-Deleted.ts', 'export class Deleted4 {}\n')
  write('db/migrations/5-Uncommitted.ts', 'export class Uncommitted5 {}\n')
  write('other/1-Outside.ts', 'export class Outside1 {}\n')
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')

  write('db/migrations/1-Edited.ts', 'export class Edited1 { changed = true }\n')
  write('db/migrations/6-Added.ts', 'export class Added6 {}\n')
  renameSync(
    path.join(dir, 'db/migrations/2-Moved.ts'),
    path.join(dir, 'db/migrations/2-Renamed.ts'),
  )
  renameSync(
    path.join(dir, 'db/migrations/3-MovedAndEdited.ts'),
    path.join(dir, 'db/migrations/3-RenamedAndEdited.ts'),
  )
  write(
    'db/migrations/3-RenamedAndEdited.ts',
    `${'export class MovedAndEdited3 {}\n'.repeat(20)}// edit\n`,
  )
  unlinkSync(path.join(dir, 'db/migrations/4-Deleted.ts'))
  write('other/1-Outside.ts', 'export class Outside1 { changed = true }\n')
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', 'feature')

  // Not committed: a local edit and an untracked file.
  write('db/migrations/5-Uncommitted.ts', 'export class Uncommitted5 { changed = true }\n')
  write('db/migrations/7-Untracked.ts', 'export class Untracked7 {}\n')
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('changesSince', () => {
  it('lists added and modified files, committed or not', async () => {
    const changes = await changesSince(dir, 'main')
    expect(changes.ref).toBe('main')
    expect(Object.fromEntries([...changes.files].sort())).toEqual({
      'db/migrations/1-Edited.ts': 'modified',
      'db/migrations/3-RenamedAndEdited.ts': 'modified',
      'db/migrations/5-Uncommitted.ts': 'modified',
      'db/migrations/6-Added.ts': 'added',
      'db/migrations/7-Untracked.ts': 'added',
      'other/1-Outside.ts': 'modified',
    })
  })

  it('gives paths relative to a subdirectory and leaves out files outside it', async () => {
    const changes = await changesSince(path.join(dir, 'db'), 'main')
    expect([...changes.files.keys()].sort()).toEqual([
      'migrations/1-Edited.ts',
      'migrations/3-RenamedAndEdited.ts',
      'migrations/5-Uncommitted.ts',
      'migrations/6-Added.ts',
      'migrations/7-Untracked.ts',
    ])
  })

  it('finds nothing when the ref is HEAD itself and the tree is clean', async () => {
    git(dir, 'add', '-A')
    git(dir, 'commit', '-q', '-m', 'rest')
    expect((await changesSince(dir, 'HEAD')).files.size).toBe(0)
  })

  it.each(['-p', '--output=/tmp/x', ''])('refuses %j as a ref', async (ref) => {
    await expect(changesSince(dir, ref)).rejects.toThrow(UsageError)
    await expect(changesSince(dir, ref)).rejects.toThrow('--changed-since needs a git ref')
  })

  it('explains an unknown ref', async () => {
    await expect(changesSince(dir, 'no-such-branch')).rejects.toThrow(
      'Could not find the merge base of "no-such-branch" and HEAD',
    )
  })

  it('explains a directory outside any git repository', async () => {
    const outside = mkdtempSync(path.join(tmpdir(), 'orm-preflight-nogit-'))
    try {
      await expect(changesSince(outside, 'main')).rejects.toThrow(
        '--changed-since needs a git repository',
      )
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('points to fetch-depth when a shallow clone has no merge base', async () => {
    git(dir, 'checkout', '-q', 'main')
    write('db/migrations/8-OnMain.ts', 'export class OnMain8 {}\n')
    git(dir, 'add', '-A')
    git(dir, 'commit', '-q', '-m', 'main moves on')
    const clone = mkdtempSync(path.join(tmpdir(), 'orm-preflight-shallow-'))
    try {
      git(
        clone,
        'clone',
        '-q',
        '--depth',
        '1',
        '--no-single-branch',
        '--branch',
        'feature',
        pathToFileURL(dir).href,
        '.',
      )
      await expect(changesSince(clone, 'origin/main')).rejects.toThrow('set fetch-depth: 0')
    } finally {
      rmSync(clone, { recursive: true, force: true })
    }
  })
})
