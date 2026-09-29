import { PassThrough } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { mcpServerOptions } from '../../src/cli/mcp.js'
import { run } from '../../src/cli/run.js'

const project = fileURLToPath(new URL('../e2e/fixtures/project/', import.meta.url))
const root = fileURLToPath(new URL('../../', import.meta.url))

function tool(name: string, cwd = project) {
  const found = mcpServerOptions(cwd, { overrides: {} }).tools.find((t) => t.name === name)
  if (found === undefined) throw new Error(`no tool ${name}`)
  return found
}

describe('check_migrations', () => {
  it.each([
    [{ files: 'src/migrations/*.ts' }, 'files must be an array of strings.'],
    [{ files: [1] }, 'files must be an array of strings.'],
    [{ changedSince: 5 }, 'changedSince must be a string.'],
    [{ dialect: 'sqlite' }, 'dialect must be "postgres" or "mysql".'],
    [{ postgresVersion: 16.5 }, 'postgresVersion must be a whole number.'],
    [{ projectDir: 3 }, 'projectDir must be a string.'],
    [{ execute: true }, 'Unknown argument: execute.'],
  ])('rejects %j', async (args, message) => {
    expect(await tool('check_migrations').call(args)).toEqual({ text: message, isError: true })
  })

  it('rejects a projectDir that is not a directory', async () => {
    const result = await tool('check_migrations').call({ projectDir: 'no/such/dir' })
    expect(result).toEqual({ text: 'projectDir "no/such/dir" is not a directory.', isError: true })
  })

  it('checks the project in projectDir', async () => {
    const result = await tool('check_migrations', root).call({ projectDir: project })
    expect(result.isError).toBeUndefined()
    expect(result.structured).toMatchObject({ summary: { errors: 2, files: 4 } })
    // The text is the same JSON document, for clients that only show text.
    expect(JSON.parse(result.text)).toEqual(result.structured)
  })

  it('lets arguments override the defaults from the command line', async () => {
    const options = mcpServerOptions(project, { overrides: { postgresVersion: 11 } })
    const check = options.tools.find((t) => t.name === 'check_migrations')
    const result = await check?.call({ postgresVersion: 16 })
    expect(result?.isError).toBeUndefined()
  })
})

describe('explain_rule and list_rules', () => {
  it('requires a rule', async () => {
    expect(await tool('explain_rule').call({})).toEqual({
      text: 'rule must be a string.',
      isError: true,
    })
  })

  it('lists rules with their databases', async () => {
    const result = await tool('list_rules').call({})
    expect(result.structured).toMatchObject({
      rules: expect.arrayContaining([
        {
          id: 'require-concurrent-index',
          category: 'locking',
          defaultSeverity: 'error',
          databases: ['PostgreSQL'],
          docsUrl: expect.stringContaining('require-concurrent-index.md') as string,
        },
      ]) as unknown,
    })
  })
})

describe('orm-preflight mcp command', () => {
  function io(stdin?: PassThrough) {
    const out = { stdout: '', stderr: '' }
    return {
      out,
      io: {
        stdout: (t: string) => (out.stdout += t),
        stderr: (t: string) => (out.stderr += t),
        cwd: project,
        ...(stdin === undefined ? {} : { stdin }),
      },
    }
  }

  it('serves until the input closes, then exits 0', async () => {
    const stdin = new PassThrough()
    const { out, io: cliIo } = io(stdin)
    const done = run(['mcp'], cliIo)
    stdin.end('{"jsonrpc":"2.0","id":1,"method":"ping"}\n')
    expect(await done).toBe(0)
    expect(out.stdout).toBe('{"jsonrpc":"2.0","id":1,"result":{}}\n')
  })

  it('takes no arguments', async () => {
    const { out, io: cliIo } = io(new PassThrough())
    expect(await run(['mcp', 'extra'], cliIo)).toBe(2)
    expect(out.stderr).toContain('"mcp" takes no arguments.')
  })

  it('needs standard input', async () => {
    const { out, io: cliIo } = io()
    expect(await run(['mcp'], cliIo)).toBe(2)
    expect(out.stderr).toContain('"mcp" needs standard input.')
  })
})
