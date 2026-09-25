import { glob } from 'tinyglobby'

/** Never linted: dependencies and build output would repeat or shadow real migrations. */
const ALWAYS_IGNORED = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']

const MIGRATION_FILE = /\.(ts|js|mjs|cjs)$/

/**
 * Migration files matching the globs, relative to `cwd`, with forward slashes, sorted.
 * Type declaration files (`.d.ts`) are skipped.
 */
export async function discoverFiles(cwd: string, patterns: readonly string[]): Promise<string[]> {
  const files = await glob([...patterns], {
    cwd,
    ignore: ALWAYS_IGNORED,
    onlyFiles: true,
    expandDirectories: false,
    dot: false,
  })
  return files
    .map((f) => f.split('\\').join('/'))
    .filter((f) => MIGRATION_FILE.test(f) && !f.endsWith('.d.ts'))
    .sort()
}
