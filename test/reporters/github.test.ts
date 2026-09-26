import { describe, expect, it } from 'vitest'
import { formatGithub } from '../../src/reporters/github.js'
import { finding, result } from './result.js'

describe('formatGithub', () => {
  it('annotates each finding that is not suppressed', async () => {
    await expect(formatGithub(result, { pathPrefix: '' })).toMatchFileSnapshot(
      './__snapshots__/github.txt',
    )
  })

  it('prefixes paths with the directory inside the repository', () => {
    expect(formatGithub(result, { pathPrefix: 'services/api' })).toContain(
      '::error file=services/api/src/migrations/1727600000000-DropBio.ts,line=5,col=30,',
    )
  })

  it('never lets text from a migration start another workflow command', () => {
    // A table name, taken from an untrusted migration, that tries to inject a command.
    const hostile = finding({
      message: '"x\n::add-mask::secret\r\n::error::fake %0A" is dropped.',
      file: 'a,b:c.ts',
    })
    const output = formatGithub({ ...result, findings: [hostile] }, { pathPrefix: '' })
    const lines = output.split('\n').filter((l) => l !== '')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(
      /^::error file=a%2Cb%3Ac\.ts,line=5,col=30,title=orm-preflight%3A no-drop-column::/,
    )
    expect(lines[0]).toContain('"x%0A::add-mask::secret%0D%0A::error::fake %250A" is dropped.')
  })

  it('ends with a summary line', () => {
    expect(formatGithub(result, { pathPrefix: '' })).toMatch(
      /\norm-preflight: 1 error, 1 warning in 2 migrations \(1 suppressed\)\n$/,
    )
  })
})
