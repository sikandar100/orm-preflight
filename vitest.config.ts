import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

export default defineConfig({
  define: { __VERSION__: JSON.stringify(pkg.version) },
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        'src/rules/**': { lines: 95 },
        'src/sql/**': { lines: 95 },
        'src/adapters/**': { lines: 95 },
      },
    },
  },
})
