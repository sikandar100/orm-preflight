import { describe, expect, it } from 'vitest'
import { callSite, toValue } from '../../../../src/adapters/typeorm/execute/recorder.js'

describe('callSite', () => {
  // Windows paths are written with BS for each backslash, which reads more easily than escapes.
  const at = (frame: string) =>
    `Error\n    at here (/tool/recorder.js:1:1)\n${frame}\n    at later (x:1:1)`

  it('finds the migration frame on POSIX', () => {
    const stack = at('    at Dynamic.up (/work/src/migrations/1-Dynamic.ts:8:25)')
    expect(callSite(stack, ['/work/src/migrations/1-Dynamic.ts'], 'm.ts', false)).toEqual({
      file: 'm.ts',
      line: 8,
      column: 25,
    })
  })

  it('finds a Windows frame with backslashes and another drive-letter case', () => {
    const stack = at(
      '    at Dynamic.up (c:BSUsersBSrunneradminBSmBS1-Dynamic.ts:8:25)'.replaceAll('BS', '\\'),
    )
    const path = 'C:BSUsersBSrunneradminBSmBS1-Dynamic.ts'.replaceAll('BS', '\\')
    expect(callSite(stack, [path], 'm.ts', true)).toEqual({ file: 'm.ts', line: 8, column: 25 })
  })

  it('finds a Windows frame written as a file URL with encoded spaces', () => {
    const stack = at('    at Dynamic.up (file:///C:/Users/My%20User/m/1-Dynamic.ts:12:9)')
    const path = 'C:BSUsersBSMy UserBSmBS1-Dynamic.ts'.replaceAll('BS', '\\')
    expect(callSite(stack, [path], 'm.ts', true)).toEqual({ file: 'm.ts', line: 12, column: 9 })
  })

  it('tries each path, such as a short 8.3 name and the long name', () => {
    const stack = at('    at Dynamic.up (C:/Users/runneradmin/m/1-Dynamic.ts:3:7)')
    const short = 'C:BSUsersBSRUNNER~1BSmBS1-Dynamic.ts'.replaceAll('BS', '\\')
    const long = 'C:BSUsersBSrunneradminBSmBS1-Dynamic.ts'.replaceAll('BS', '\\')
    expect(callSite(stack, [short], 'm.ts', true)).toBeUndefined()
    expect(callSite(stack, [short, long], 'm.ts', true)).toEqual({
      file: 'm.ts',
      line: 3,
      column: 7,
    })
  })
})

describe('toValue', () => {
  it('keeps the class name of schema objects, as static extraction does', () => {
    class TableColumn {
      name = 'bio'
    }
    const value = toValue(new TableColumn(), 0)
    expect(value).toMatchObject({ kind: 'object', ctor: 'TableColumn', partial: false })
  })

  it('turns functions into unknown values', () => {
    expect(toValue(() => 1, 0)).toEqual({ kind: 'unknown', reason: 'The value is a function' })
  })
})
