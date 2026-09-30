import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  feedback,
  handle,
  looksLikeMigration,
  projectDirFor,
} from '../../plugins/orm-preflight/scripts/check-migration.mjs'
import { resolveCommand } from '../../plugins/orm-preflight/scripts/orm-preflight.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const pluginDir = path.join(root, 'plugins', 'orm-preflight')
const cli = path.join(root, 'dist', 'cli.mjs')
const hookScript = path.join(pluginDir, 'scripts', 'check-migration.mjs')
const launcher = path.join(pluginDir, 'scripts', 'orm-preflight.mjs')

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
}

const pkg = readJson(path.join(root, 'package.json')) as { version: string }

const DANGEROUS = `import { MigrationInterface, QueryRunner } from 'typeorm'

export class WidenName1727100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`ALTER TABLE "users" DROP COLUMN "name"\`)
    await queryRunner.query(\`ALTER TABLE "users" ADD "name" character varying(255)\`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`ALTER TABLE "users" DROP COLUMN "name"\`)
  }
}
`

const SAFE = `import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddBio1727200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`ALTER TABLE "users" ADD "bio" text\`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`ALTER TABLE "users" DROP COLUMN "bio"\`)
  }
}
`

describe('plugin files', () => {
  it('has the same version as the package', () => {
    const plugin = readJson(path.join(pluginDir, '.claude-plugin', 'plugin.json'))
    expect(plugin.version).toBe(pkg.version)
    expect(plugin.name).toBe('orm-preflight')
  })

  it('has a square SVG icon for the plugin directory', () => {
    const icon = readFileSync(path.join(pluginDir, '.claude-plugin', 'icon.svg'), 'utf8')
    expect(icon).toMatch(/^<svg [^>]*viewBox="0 0 256 256"/)
  })

  it('is listed in the marketplace at an existing path', () => {
    const marketplace = readJson(path.join(root, '.claude-plugin', 'marketplace.json')) as {
      name: string
      plugins: { name: string; source: string }[]
    }
    expect(marketplace.name).toBe('orm-preflight')
    expect(marketplace.plugins).toHaveLength(1)
    const [entry] = marketplace.plugins
    expect(entry?.name).toBe('orm-preflight')
    expect(existsSync(path.join(root, entry?.source ?? '', '.claude-plugin', 'plugin.json'))).toBe(
      true,
    )
  })

  it('runs scripts that exist, through node', () => {
    const hooks = readFileSync(path.join(pluginDir, 'hooks', 'hooks.json'), 'utf8')
    const mcp = readFileSync(path.join(pluginDir, '.mcp.json'), 'utf8')
    expect(hooks).toContain('node \\"${CLAUDE_PLUGIN_ROOT}/scripts/check-migration.mjs\\"')
    expect(mcp).toContain('"${CLAUDE_PLUGIN_ROOT}/scripts/orm-preflight.mjs", "mcp"')
    expect(existsSync(hookScript)).toBe(true)
    expect(existsSync(launcher)).toBe(true)
  })
})

describe('looksLikeMigration', () => {
  it.each([
    ['src/migrations/1727-AddBio.ts', ''],
    ['db/Migration/1727-AddBio.js', ''],
    ['src/db/1727-AddBio.ts', 'async up(queryRunner: QueryRunner) {'],
  ])('accepts %s', (file, text) => {
    expect(looksLikeMigration(file, text)).toBe(true)
  })

  it.each([
    ['src/users/user.entity.ts', 'export class User {}'],
    ['src/migrations/README.md', ''],
    ['src/migrations/types.d.ts', ''],
  ])('skips %s', (file, text) => {
    expect(looksLikeMigration(file, text)).toBe(false)
  })
})

describe('the hook', () => {
  let project: string

  beforeEach(() => {
    project = mkdtempSync(path.join(tmpdir(), 'orm-preflight-plugin-'))
    writeFileSync(path.join(project, 'package.json'), '{"name":"app","private":true}')
    mkdirSync(path.join(project, 'src', 'migrations'), { recursive: true })
  })

  afterEach(() => {
    rmSync(project, { recursive: true, force: true })
  })

  function runHook(filePath: string) {
    const event = {
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      cwd: project,
      tool_input: { file_path: filePath },
    }
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key !== 'CLAUDE_PROJECT_DIR'),
    )
    return spawnSync(process.execPath, [hookScript], {
      input: JSON.stringify(event),
      encoding: 'utf8',
      env: { ...env, ORM_PREFLIGHT_CLI: cli },
    })
  }

  it('hands the findings of a dangerous migration back to Claude', () => {
    const file = path.join(project, 'src', 'migrations', '1727100000000-WidenName.ts')
    writeFileSync(file, DANGEROUS)
    const result = runHook(file)
    expect(result.status).toBe(0)
    const output = JSON.parse(result.stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string }
    }
    expect(output.hookSpecificOutput.hookEventName).toBe('PostToolUse')
    const text = output.hookSpecificOutput.additionalContext
    expect(text).toContain(
      'orm-preflight found 1 problem in the migration src/migrations/1727100000000-WidenName.ts',
    )
    expect(text).toContain('no-drop-and-recreate-column (error)')
    expect(text).toContain('Safe way:')
    expect(text).toContain('Do not add a "preflight safety-assured" comment')
    // One line of JSON: Claude Code reads the first line that starts with "{".
    expect(result.stdout.trim().split('\n')).toHaveLength(1)
  })

  function context(stdout: string): string {
    return (JSON.parse(stdout) as { hookSpecificOutput: { additionalContext: string } })
      .hookSpecificOutput.additionalContext
  }

  it('tells Claude that a safe migration was checked', () => {
    const file = path.join(project, 'src', 'migrations', '1727200000000-AddBio.ts')
    writeFileSync(file, SAFE)
    const result = runHook('src/migrations/1727200000000-AddBio.ts')
    expect(result.status).toBe(0)
    expect(context(result.stdout)).toBe(
      'orm-preflight checked the migration src/migrations/1727200000000-AddBio.ts: no problems found.',
    )
  })

  it('tells Claude when startAfter skips the migration', () => {
    writeFileSync(path.join(project, 'orm-preflight.config.json'), '{"startAfter": 1727900000000}')
    const file = path.join(project, 'src', 'migrations', '1727200000000-AddBio.ts')
    writeFileSync(file, DANGEROUS)
    const result = runHook(file)
    expect(context(result.stdout)).toBe(
      'orm-preflight did not check the migration src/migrations/1727200000000-AddBio.ts: it is not after "startAfter" in the orm-preflight config, so it counts as a migration that already ran. Editing a migration that already ran does not change databases where it ran.',
    )
  })

  it('skips other files without running orm-preflight', () => {
    const file = path.join(project, 'src', 'user.entity.ts')
    writeFileSync(file, 'export class User {}\n')
    const calls: string[][] = []
    const output = handle({ cwd: project, tool_input: { file_path: file } }, (_dir, args) => {
      calls.push(args)
      return { status: 0, stdout: '', stderr: '' }
    })
    expect(output).toBeUndefined()
    expect(calls).toEqual([])
  })

  it('runs in the nearest package folder, with a path relative to it', () => {
    mkdirSync(path.join(project, 'packages', 'api', 'migrations'), { recursive: true })
    writeFileSync(path.join(project, 'packages', 'api', 'package.json'), '{}')
    const file = path.join(project, 'packages', 'api', 'migrations', '1727-A.ts')
    writeFileSync(file, SAFE)
    expect(projectDirFor(file, project)).toBe(path.join(project, 'packages', 'api'))
    const calls: { dir: string; args: string[] }[] = []
    handle({ cwd: project, tool_input: { file_path: file } }, (dir, args) => {
      calls.push({ dir, args })
      return { status: 0, stdout: '{"summary":{"migrations":1},"findings":[]}', stderr: '' }
    })
    expect(calls).toEqual([
      {
        dir: path.join(project, 'packages', 'api'),
        args: ['--format', 'json', 'migrations/1727-A.ts'],
      },
    ])
  })

  it('ignores events without a file and files that are gone', () => {
    expect(handle({ tool_input: {} })).toBeUndefined()
    expect(handle({ cwd: project, tool_input: { file_path: 'nope/1727-A.ts' } })).toBeUndefined()
  })
})

describe('feedback', () => {
  it('counts suppressed findings as no problems', () => {
    const stdout = JSON.stringify({
      summary: { migrations: 1 },
      findings: [
        {
          ruleId: 'no-drop-column',
          severity: 'error',
          file: 'm.ts',
          line: 3,
          message: 'm',
          why: 'w',
          safeAlternative: null,
          docsUrl: 'd',
          suppressed: { reason: 'r' },
        },
      ],
    })
    expect(feedback('m.ts', { status: 1, stdout, stderr: '' })).toBe(
      'orm-preflight checked the migration m.ts: no problems found.',
    )
  })

  it('reports a check that could not run, briefly', () => {
    expect(
      feedback('m.ts', {
        status: 2,
        stdout: '',
        stderr: 'orm-preflight: MySQL support needs the node-sql-parser package.\n',
      }),
    ).toBe(
      'orm-preflight could not check the migration m.ts: MySQL support needs the node-sql-parser package.',
    )
  })
})

describe('the launcher', () => {
  let project: string

  beforeEach(() => {
    project = mkdtempSync(path.join(tmpdir(), 'orm-preflight-launcher-'))
  })

  afterEach(() => {
    rmSync(project, { recursive: true, force: true })
  })

  function install(version: string) {
    const dir = path.join(project, 'node_modules', 'orm-preflight')
    mkdirSync(path.join(dir, 'dist'), { recursive: true })
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version }))
    writeFileSync(path.join(dir, 'dist', 'cli.mjs'), '')
    return path.join(dir, 'dist', 'cli.mjs')
  }

  it("uses the project's own install", () => {
    const local = install('1.0.2')
    expect(resolveCommand(project, ['--format', 'json'], {})).toEqual({
      command: process.execPath,
      args: [local, '--format', 'json'],
      shell: false,
    })
  })

  it('uses the plugin version through npx for mcp when the install is too old', () => {
    install('1.0.2')
    const { args } = resolveCommand(project, ['mcp'], {})
    expect(args.slice(-3)).toEqual(['-y', `orm-preflight@${pkg.version}`, 'mcp'])
  })

  it('uses a new enough install for mcp', () => {
    const local = install('1.1.0')
    expect(resolveCommand(project, ['mcp'], {}).args).toEqual([local, 'mcp'])
  })

  it('uses the plugin version through npx without an install', () => {
    const { args } = resolveCommand(project, ['--version'], {})
    expect(args.slice(-3)).toEqual(['-y', `orm-preflight@${pkg.version}`, '--version'])
  })

  it('passes stdin and stdout through for the MCP server', () => {
    const result = spawnSync(process.execPath, [launcher, 'mcp'], {
      cwd: project,
      input: '{"jsonrpc":"2.0","id":7,"method":"ping"}\n',
      encoding: 'utf8',
      env: { ...process.env, ORM_PREFLIGHT_CLI: cli, CLAUDE_PROJECT_DIR: project },
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('{"jsonrpc":"2.0","id":7,"result":{}}\n')
  })
})
