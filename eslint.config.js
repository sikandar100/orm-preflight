import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

const coreMessage =
  'Core code must not import from src/adapters/. Keep ORM-specific logic inside the adapter.'
const registryMessage =
  'Composition roots may import only the adapter registry (adapters/index.js), never adapter internals.'
const typeormMessage =
  'orm-preflight has no dependency on typeorm. Static mode must never load the user project runtime.'

const noTypeorm = { name: 'typeorm', message: typeormMessage }
const noTypeormSubpaths = { group: ['typeorm/*'], message: typeormMessage }

/**
 * The core and adapter boundary. Exported separately so a test can prove it fires.
 * Core: everything in src/ except src/adapters/. Composition roots (src/index.ts and
 * src/cli/) may import the adapter registry and nothing else from src/adapters/.
 */
export const boundaryConfigs = defineConfig(
  {
    name: 'orm-preflight/boundary/core',
    files: ['src/**/*.ts'],
    ignores: ['src/adapters/**', 'src/index.ts', 'src/cli/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [noTypeorm],
          patterns: [
            { group: ['**/adapters', '**/adapters/**'], message: coreMessage },
            noTypeormSubpaths,
          ],
        },
      ],
    },
  },
  {
    name: 'orm-preflight/boundary/composition-roots',
    files: ['src/index.ts', 'src/cli/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [noTypeorm],
          patterns: [
            { group: ['**/adapters/**', '!**/adapters/index.js'], message: registryMessage },
            noTypeormSubpaths,
          ],
        },
      ],
    },
  },
  {
    name: 'orm-preflight/boundary/adapters',
    files: ['src/adapters/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: [noTypeorm], patterns: [noTypeormSubpaths] }],
    },
  },
)

export default defineConfig(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  boundaryConfigs,
  prettier,
)
