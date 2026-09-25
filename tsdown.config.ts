import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

const shared = {
  platform: 'node',
  target: 'node20',
  define: { __VERSION__: JSON.stringify(pkg.version) },
} as const

export default defineConfig([
  {
    ...shared,
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
  },
  {
    ...shared,
    entry: { cli: 'src/cli/index.ts' },
    format: ['esm'],
    dts: false,
    clean: false,
  },
  {
    // Internal: lets the installed-package smoke test load the SQL parsers.
    ...shared,
    entry: { 'internal-sql-check': 'src/internal/sql-check.ts' },
    format: ['esm', 'cjs'],
    dts: false,
    clean: false,
  },
])
