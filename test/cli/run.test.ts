import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { allRules } from '../../src/cli/commands.js'
import { ExitCode } from '../../src/cli/exit-codes.js'
import { helpText, run } from '../../src/cli/run.js'
import { version } from '../../src/index.js'

let dir: string

function write(file: string, text: string) {
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
  writeFileSync(path.join(dir, file), text)
}

const migration = (
  name: string,
  sql: string,
) => `import { MigrationInterface, QueryRunner } from 'typeorm'

export class ${name} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`${sql}\`)
  }

  public async down(): Promise<void> {}
}
`

async function runCli(argv: string[], options: { color?: boolean } = {}) {
  let stdout = ''
  let stderr = ''
  const code = await run(argv, {
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
    cwd: dir,
    ...options,
  })
  return { code, stdout, stderr }
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'orm-preflight-cli-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('options', () => {
  it.each(['--version', '-v'])('prints the version for %s', async (flag) => {
    expect(await runCli([flag])).toEqual({ code: ExitCode.Ok, stdout: `${version}\n`, stderr: '' })
  })

  it.each(['--help', '-h'])('prints help for %s', async (flag) => {
    expect(await runCli([flag])).toEqual({ code: ExitCode.Ok, stdout: helpText, stderr: '' })
  })

  it('exits 2 on an unknown option', async () => {
    const result = await runCli(['--bogus'])
    expect(result.code).toBe(ExitCode.UsageOrInternalError)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain("Unknown option '--bogus'")
    expect(result.stderr).toContain('orm-preflight --help')
  })

  it.each([
    [['--format', 'xml'], 'Unknown format "xml". Use pretty or json.'],
    [['--max-warnings=-1'], '--max-warnings must be a whole number, got "-1".'],
    [['--max-warnings', '1.5'], '--max-warnings must be a whole number, got "1.5".'],
    [['--postgres-version', 'sixteen'], '--postgres-version must be a whole number'],
    [['--postgres-version', '9'], '--postgres-version must be at least 12'],
    [['--dialect', 'oracle'], '--dialect'],
  ])('exits 2 on %j', async (argv, message) => {
    write('migrations/1727000000000-A.ts', migration('A1727000000000', 'SELECT 1'))
    const result = await runCli(argv)
    expect(result.code).toBe(ExitCode.UsageOrInternalError)
    expect(result.stderr).toContain(message)
  })

  it('keeps help free of em dashes', () => {
    expect(helpText).not.toMatch(/[–—]/)
  })
})

describe('linting', () => {
  beforeEach(() => {
    write('src/migrations/1727000000000-Clean.ts', migration('Clean1727000000000', 'SELECT 1'))
  })

  it('exits 0 when there are no findings', async () => {
    const result = await runCli([])
    expect(result).toEqual({
      code: ExitCode.Ok,
      stdout: '0 errors, 0 warnings in 1 migration\n',
      stderr: '',
    })
  })

  it('exits 1 on an error and prints it', async () => {
    write(
      'src/migrations/1727600000000-DropBio.ts',
      migration('DropBio1727600000000', 'ALTER TABLE "users" DROP COLUMN "bio"'),
    )
    const result = await runCli([])
    expect(result.code).toBe(ExitCode.LintFailed)
    expect(result.stdout).toContain(
      'src/migrations/1727600000000-DropBio.ts\n  5:30  error  no-drop-column\n',
    )
    expect(result.stdout).toContain('1 error, 0 warnings in 2 migrations\n')
  })

  it('lints only the files given', async () => {
    write('other/1727600000000-DropBio.ts', migration('DropBio1727600000000', 'DROP TABLE "x"'))
    const result = await runCli(['other/*.ts'])
    expect(result.code).toBe(ExitCode.LintFailed)
    expect(result.stdout).toContain('in 1 migration\n')
  })

  it('prints JSON with --format json', async () => {
    const result = await runCli(['--format', 'json'])
    expect(result.code).toBe(ExitCode.Ok)
    expect(JSON.parse(result.stdout)).toMatchObject({ version, findings: [] })
  })

  describe('--max-warnings', () => {
    beforeEach(() => {
      write('src/migrations/1727600000000-Dynamic.ts', migration('Dynamic1727600000000', '${sql}'))
    })

    it('passes warnings by default', async () => {
      const result = await runCli([])
      expect(result.code).toBe(ExitCode.Ok)
      expect(result.stdout).toContain('0 errors, 1 warning in 2 migrations')
    })

    it('passes when warnings are within the limit', async () => {
      expect((await runCli(['--max-warnings', '1'])).code).toBe(ExitCode.Ok)
    })

    it('fails when warnings exceed the limit', async () => {
      const result = await runCli(['--max-warnings', '0'])
      expect(result.code).toBe(ExitCode.LintFailed)
      expect(result.stdout).toContain('Too many warnings: 1, and --max-warnings is 0.')
    })
  })

  it('uses colors only when supported and not turned off', async () => {
    const escape = String.fromCharCode(27)
    expect((await runCli([], { color: true })).stdout).toContain(escape)
    expect((await runCli(['--no-color'], { color: true })).stdout).not.toContain(escape)
    expect((await runCli([])).stdout).not.toContain(escape)
  })

  it('reads the config given with -c', async () => {
    write('custom.json', JSON.stringify({ rules: { 'no-drop-table': 'warn' } }))
    write('src/migrations/1727600000000-Drop.ts', migration('Drop1727600000000', 'DROP TABLE "x"'))
    const result = await runCli(['-c', 'custom.json'])
    expect(result.code).toBe(ExitCode.Ok)
    expect(result.stdout).toContain('warn   no-drop-table')
  })

  it('exits 2 with the problem on an invalid config', async () => {
    write('orm-preflight.config.json', JSON.stringify({ rules: { 'no-drop-tabel': 'off' } }))
    const result = await runCli([])
    expect(result.code).toBe(ExitCode.UsageOrInternalError)
    expect(result.stderr).toContain('no-drop-tabel')
  })

  it('exits 2 when no files match', async () => {
    const result = await runCli(['nothing/*.ts'])
    expect(result.code).toBe(ExitCode.UsageOrInternalError)
    expect(result.stderr).toContain('No migration files matched: nothing/*.ts')
  })

  it('reports an internal error with exit code 2', async () => {
    let stderr = ''
    const code = await run([], {
      stdout: () => {
        throw new Error('disk full')
      },
      stderr: (text) => (stderr += text),
      cwd: dir,
    })
    expect(code).toBe(ExitCode.UsageOrInternalError)
    expect(stderr).toContain('internal error: Error: disk full')
    expect(stderr).toContain('https://github.com/sikandar100/orm-preflight/issues')
  })
})

describe('rules', () => {
  it('lists every rule with its category, severity, and databases', async () => {
    const result = await runCli(['rules'])
    expect(result.code).toBe(ExitCode.Ok)
    for (const rule of allRules()) expect(result.stdout).toContain(rule.meta.id)
    expect(result.stdout).toMatch(/^no-set-not-null +locking +error +PostgreSQL$/m)
    expect(result.stdout).toMatch(/^unanalyzable-statement +correctness +warn +PostgreSQL, MySQL$/m)
  })

  it('takes no arguments', async () => {
    expect((await runCli(['rules', 'extra'])).code).toBe(ExitCode.UsageOrInternalError)
  })
})

describe('explain', () => {
  it('prints the rule documentation', async () => {
    const result = await runCli(['explain', 'typeorm/no-changecolumn-recreate'])
    expect(result.code).toBe(ExitCode.Ok)
    expect(result.stdout.startsWith('# typeorm/no-changecolumn-recreate\n')).toBe(true)
  })

  it.each([
    ['no-drop-colum', 'Did you mean "no-drop-column"?'],
    ['no-changecolumn-recreate', 'Did you mean "typeorm/no-changecolumn-recreate"?'],
    ['changecolumn-recreate', 'Did you mean "typeorm/no-changecolumn-recreate"?'],
    ['something-else-entirely', 'Run "orm-preflight rules"'],
  ])('exits 2 on unknown rule %s', async (id, message) => {
    const result = await runCli(['explain', id])
    expect(result.code).toBe(ExitCode.UsageOrInternalError)
    expect(result.stderr).toContain(`Unknown rule "${id}".`)
    expect(result.stderr).toContain(message)
  })

  it.each([[['explain']], [['explain', 'a', 'b']]])('exits 2 on %j', async (argv) => {
    const result = await runCli(argv)
    expect(result.code).toBe(ExitCode.UsageOrInternalError)
    expect(result.stderr).toContain('Usage: orm-preflight explain <rule>')
  })
})

describe('init', () => {
  const config = () =>
    JSON.parse(readFileSync(path.join(dir, 'orm-preflight.config.json'), 'utf8')) as unknown

  it('sets startAfter to the newest existing migration', async () => {
    write('src/migrations/1727000000000-A.ts', migration('A1727000000000', 'SELECT 1'))
    write('src/migrations/1727900000000-B.ts', migration('B1727900000000', 'DROP TABLE "x"'))
    const result = await runCli(['init'])
    expect(result.code).toBe(ExitCode.Ok)
    expect(result.stdout).toContain(
      'startAfter is 1727900000000, the newest of 2 existing migrations',
    )
    expect(result.stdout).toContain('default location: **/migrations/*.{ts,js,mjs,cjs}\n')
    expect(result.stdout).toContain('typeorm.transactionMode')
    expect(config()).toEqual({
      $schema: './node_modules/orm-preflight/schema.json',
      orm: 'typeorm',
      dialect: 'postgres',
      postgresVersion: 16,
      startAfter: 1727900000000,
      typeorm: { transactionMode: 'all' },
    })
    // The existing migrations are now history, so linting passes.
    expect((await runCli([])).stdout).toBe('0 errors, 0 warnings in 0 migrations\n')
  })

  it('records the given globs and options', async () => {
    write('db/1727000000000-A.ts', migration('A1727000000000', 'SELECT 1'))
    const result = await runCli(['init', 'db/*.ts', '--dialect', 'mysql'])
    expect(result.code).toBe(ExitCode.Ok)
    expect(result.stdout).not.toContain('default location')
    expect(config()).toEqual({
      $schema: './node_modules/orm-preflight/schema.json',
      orm: 'typeorm',
      dialect: 'mysql',
      migrations: ['db/*.ts'],
      startAfter: 1727000000000,
      typeorm: { transactionMode: 'all' },
    })
  })

  it('leaves out startAfter when there are no migrations', async () => {
    const result = await runCli(['init'])
    expect(result.code).toBe(ExitCode.Ok)
    expect(result.stdout).toContain('No existing migrations were found')
    expect(config()).not.toHaveProperty('startAfter')
  })

  it('never overwrites a config', async () => {
    write('orm-preflight.config.json', '{}')
    const result = await runCli(['init'])
    expect(result.code).toBe(ExitCode.UsageOrInternalError)
    expect(result.stderr).toContain('orm-preflight.config.json already exists.')
    expect(readFileSync(path.join(dir, 'orm-preflight.config.json'), 'utf8')).toBe('{}')
  })

  it('refuses when package.json has a config', async () => {
    write('package.json', JSON.stringify({ ormPreflight: {} }))
    const result = await runCli(['init'])
    expect(result.code).toBe(ExitCode.UsageOrInternalError)
    expect(result.stderr).toContain('package.json already has an "ormPreflight" config.')
    expect(existsSync(path.join(dir, 'orm-preflight.config.json'))).toBe(false)
  })

  it('ignores a package.json that is not valid JSON', async () => {
    write('package.json', '{')
    expect((await runCli(['init'])).code).toBe(ExitCode.Ok)
  })

  it('exits 2 on an unknown ORM', async () => {
    const result = await runCli(['init', '--orm', 'prisma'])
    expect(result.code).toBe(ExitCode.UsageOrInternalError)
    expect(result.stderr).toContain('prisma')
  })
})

describe('--changed-since', () => {
  const git = (...args: string[]) =>
    execFileSync(
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
      { cwd: dir, stdio: 'ignore' },
    )

  beforeEach(() => {
    git('init', '-q', '-b', 'main')
    write(
      'src/migrations/1727000000000-Old.ts',
      migration('Old1727000000000', 'DROP TABLE "legacy"'),
    )
    git('add', '-A')
    git('commit', '-q', '-m', 'base')
    git('checkout', '-q', '-b', 'feature')
  })

  it('exits 0 when no migration changed', async () => {
    const result = await runCli(['--changed-since', 'main'])
    expect(result).toEqual({
      code: ExitCode.Ok,
      stdout: '0 errors, 0 warnings in 0 migrations\n',
      stderr: '',
    })
  })

  it('checks only migrations added or changed on the branch', async () => {
    write(
      'src/migrations/1727600000000-DropBio.ts',
      migration('DropBio1727600000000', 'ALTER TABLE "users" DROP COLUMN "bio"'),
    )
    const result = await runCli(['--changed-since', 'main', '--format', 'json'])
    expect(result.code).toBe(ExitCode.LintFailed)
    const output = JSON.parse(result.stdout) as { findings: { file: string; ruleId: string }[] }
    expect(output.findings.map((f) => `${f.file} ${f.ruleId}`)).toEqual([
      'src/migrations/1727600000000-DropBio.ts no-drop-column',
    ])
  })

  it('reports an edit to a migration that exists on the base branch', async () => {
    write('src/migrations/1727000000000-Old.ts', migration('Old1727000000000', 'SELECT 1'))
    const result = await runCli(['--changed-since', 'main'])
    expect(result.code).toBe(ExitCode.Ok)
    expect(result.stdout).toContain('warn   no-edit-applied-migration')
    expect(result.stdout).toContain('already exists on main and was changed')
  })

  it('treats a table created by any changed migration as new', async () => {
    write(
      'src/migrations/1727600000000-Create.ts',
      migration('Create1727600000000', 'CREATE TABLE "notes" ("id" int)'),
    )
    write(
      'src/migrations/1727700000000-Index.ts',
      migration('Index1727700000000', 'CREATE INDEX "IDX_notes_id" ON "notes" ("id")'),
    )
    expect((await runCli(['--changed-since', 'main'])).code).toBe(ExitCode.Ok)
    // Without the flag, the index migration is checked on its own and the table is not new.
    expect((await runCli([])).stdout).toContain('require-concurrent-index')
  })

  it('exits 2 on an unknown ref', async () => {
    const result = await runCli(['--changed-since', 'nope'])
    expect(result.code).toBe(ExitCode.UsageOrInternalError)
    expect(result.stderr).toContain('Could not find the merge base of "nope" and HEAD')
  })
})

describe('--changed-since outside a git repository', () => {
  it('exits 2 and says why', async () => {
    write('src/migrations/1727000000000-A.ts', migration('A1727000000000', 'SELECT 1'))
    const result = await runCli(['--changed-since', 'main'])
    expect(result.code).toBe(ExitCode.UsageOrInternalError)
    expect(result.stderr).toContain('--changed-since needs a git repository')
  })
})
