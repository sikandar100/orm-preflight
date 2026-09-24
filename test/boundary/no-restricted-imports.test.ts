import { ESLint } from 'eslint'
import { fileURLToPath } from 'node:url'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import { boundaryConfigs } from '../../eslint.config.js'

const eslint = new ESLint({
  cwd: fileURLToPath(new URL('../../', import.meta.url)),
  overrideConfigFile: true,
  overrideConfig: [
    { files: ['**/*.ts'], languageOptions: { parser: tseslint.parser } },
    ...boundaryConfigs,
  ],
})

async function violations(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? []).map((m) => `${m.ruleId ?? 'fatal'}: ${m.message}`)
}

describe('core and adapter boundary', () => {
  it.each([
    ['src/engine/run.ts', `import { x } from '../adapters/typeorm/extract/index.js'`],
    ['src/engine/run.ts', `import { adapters } from '../adapters/index.js'`],
    ['src/rules/no-drop-column.ts', `import type { OrmAdapter } from '../adapters/types.js'`],
    ['src/sql/postgres/parse.ts', `export * from '../../adapters/typeorm/rules/index.js'`],
    ['src/cli/main.ts', `import { x } from '../adapters/typeorm/index.js'`],
    ['src/index.ts', `import { x } from './adapters/types.js'`],
    ['src/engine/run.ts', `import { DataSource } from 'typeorm'`],
    ['src/adapters/typeorm/builder.ts', `import { TableColumn } from 'typeorm'`],
    [
      'src/adapters/typeorm/builder.ts',
      `import { Table } from 'typeorm/schema-builder/table/Table.js'`,
    ],
  ])('rejects %s: %s', async (filePath, code) => {
    const messages = await violations(filePath, code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatch(/^no-restricted-imports:/)
  })

  it.each([
    ['src/cli/main.ts', `import { adapters } from '../adapters/index.js'`],
    ['src/index.ts', `export { adapters } from './adapters/index.js'`],
    [
      'src/adapters/typeorm/rules/no-enum-recreate.ts',
      `import type { Rule } from '../../../rules/types.js'`,
    ],
    ['src/adapters/typeorm/extract/index.ts', `import { x } from '../builder.js'`],
    ['src/engine/run.ts', `import { parse } from '../sql/postgres/parse.js'`],
  ])('allows %s: %s', async (filePath, code) => {
    expect(await violations(filePath, code)).toEqual([])
  })
})
