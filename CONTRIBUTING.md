# Contributing to orm-preflight

Thank you for helping. This guide covers setup, the checks your change must pass, and the rules that keep the project safe and stable.

## Setup

You need Node.js 22.12 or newer for development (the published package supports Node 20 and newer) and pnpm. The exact pnpm version is pinned in `package.json`, and pnpm switches to it automatically.

```bash
git clone https://github.com/sikandar100/orm-preflight.git
cd orm-preflight
pnpm install
```

`pnpm install` also installs the git hooks (through the `prepare` script). If you edit `lefthook.yml`, run `pnpm exec lefthook install` again.

## Scripts

| Command                                  | What it does                                               |
| ---------------------------------------- | ---------------------------------------------------------- |
| `pnpm build`                             | Build `dist/` (ESM, CJS, and type declarations)            |
| `pnpm test`                              | Build, then run unit and end-to-end tests                  |
| `pnpm test:coverage`                     | Tests with coverage thresholds                             |
| `pnpm lint`                              | ESLint, including the core and adapter boundary rule       |
| `pnpm typecheck`                         | TypeScript in strict mode                                  |
| `pnpm format`                            | Format with Prettier                                       |
| `pnpm check:pack`                        | Check that the npm tarball contains only the allowed files |
| `pnpm check:publint` / `pnpm check:attw` | Check package exports and type resolution                  |
| `pnpm check:secrets`                     | Scan the working tree for secrets                          |

Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` before opening a pull request. CI runs all of these checks, and runs the tests on Linux, Windows, and macOS.

## Commits and pull requests

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/). A git hook checks this.
- If your change affects users, add a changeset: run `pnpm changeset` and describe the change in one or two sentences.
- Keep pull requests small and focused on one change.

## Never commit

The pre-commit hook and CI block these, but please check `git status` before committing:

- secrets, tokens, `.env` files, `.npmrc`, private keys
- `dist/`, `coverage/`, and `.tgz` tarballs
- files over 500 KB

Stage files by name (`git add <path>`) instead of `git add -A`.

## Architecture rules

- The core (IR, SQL parsing, core rules, engine, reporters, CLI) must not import from `src/adapters/`. Only `src/index.ts` and `src/cli/` may import the adapter registry, `src/adapters/index.ts`. ESLint enforces this.
- Nothing may import `typeorm`. orm-preflight never loads the user's ORM.
- Static mode must never import or execute migration files.
- SQL parsers load lazily, on first use. `libpg-query` (PostgreSQL, WebAssembly) is a dependency; `node-sql-parser` (MySQL) is an optional peer dependency, installed for development. Every SQL statement must be mapped to operations, listed as irrelevant, or reported as unanalyzable, never dropped silently.
- New runtime dependencies need maintainer approval.

## Public API

Rule IDs, config keys, CLI flags, exit codes, and the JSON output shape are public API. Do not rename or remove them without discussing it in an issue first.

New rules ship at `warn` severity in a minor release. A rule can become `error` only in a major release, so upgrading never breaks a user's CI unexpectedly.

## How to add a rule

Work tests first. For a core rule `<id>` (an adapter rule lives under `src/adapters/<orm>/rules/`
and `test/adapters/<orm>/rules/`, with the ID `<orm>/<name>`):

1. **Bad fixtures.** Add migrations to `test/rules/<id>/bad/` that must produce the rule's
   finding. Prefer real `migration:generate` output, and cover SQL and builder calls. An optional
   first line sets the config: `// fixture: {"postgresVersion": 18}`.
2. **Good fixtures.** Add migrations to `test/rules/<id>/good/` that must not produce it,
   including the safe alternative the rule suggests.
3. **The rule.** Write `src/rules/<id>.ts` and add it to `coreRules` in `src/rules/index.ts`.
   A rule reads the analyzed operations and returns findings; it never does I/O. Set `target`
   so the engine can skip tables created in the same migration.
4. **Snapshots.** Run `pnpm test -u` and review every `.findings.json` file it writes. Each one
   holds the complete findings for its fixture.
5. **Config schema.** Add the rule ID to `rules` in `schema.json`. A test checks that it lists
   every rule.
6. **Documentation.** Write `docs/rules/<id>.md` in the format of the existing pages: summary,
   What happens, Bad, Safe, When to suppress, References. Cite the PostgreSQL or MySQL
   documentation section behind every claim, and check that each link works. The Bad and Safe
   examples are linted by `test/docs/rule-docs.test.ts`. Add the page to
   `src/cli/rule-docs.ts` and to `docs/rules/README.md`.
7. **Locking claims.** If the rule makes a claim about PostgreSQL locks or rewrites, add a check
   to `test/verify/verify-locks.sh` and record the results.

Run `pnpm test`, `pnpm lint`, and `pnpm typecheck` before opening the pull request, and add a
changeset. A new rule ships at `warn` (see Public API above).

## Writing style

README, docs, and CLI messages use plain, direct English. Do not use em dashes.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
