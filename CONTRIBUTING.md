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
- New runtime dependencies need maintainer approval.

## Public API

Rule IDs, config keys, CLI flags, exit codes, and the JSON output shape are public API. Do not rename or remove them without discussing it in an issue first.

New rules ship at `warn` severity in a minor release. A rule can become `error` only in a major release, so upgrading never breaks a user's CI unexpectedly.

## How to add a rule

A step-by-step guide arrives with the rule engine in 0.1.0. In short, every rule needs:

1. Tests first: bad fixtures that must produce the expected findings, then good fixtures that must produce none.
2. The rule implementation.
3. A documentation page that cites the PostgreSQL or MySQL documentation section behind its claim.

## Writing style

README, docs, and CLI messages use plain, direct English. Do not use em dashes.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
