# orm-preflight

Preflight safety checks for ORM migrations. Version 1 ships the TypeORM adapter.

The maintainer's full specification lives in `docs/SPEC.md`. It is kept local and is not committed to this repository. When it is present, read it before starting any task. It is the source of truth: if the code and the spec disagree, stop and ask. When it is absent (for example in a contributor's clone), follow `CONTRIBUTING.md` and the existing code.

## Working rules

- Work one milestone at a time (SPEC section 11). Plan first, wait for my approval, then implement.
- Tests first for every rule: bad fixtures, then good fixtures, then the rule.
- Run the test, lint, and typecheck scripts before saying a task is done. Never report done with failing checks.
- No runtime dependencies beyond SPEC section 5.6 without asking.
- Keep the core (IR, SQL parsing, core rules, engine, reporters, CLI) free of TypeORM imports and assumptions. TypeORM logic lives only in `src/adapters/typeorm/` (SPEC section 5.2).
- Adapter rule IDs are always prefixed: `typeorm/<name>`. Core rule IDs are unprefixed.
- Rule IDs, config keys, CLI flags, exit codes, and the JSON output shape are public API. Never rename them without asking.
- Every rule doc cites the PostgreSQL or MySQL documentation section behind its claim. If a claim cannot be verified, ship the rule as `warn` and tell me.
- Static mode code paths must never import or execute migration files.
- Never publish to npm, push tags, create releases, or change GitHub repository settings. I handle releases.
- Never push commits without my explicit approval. Stage files by explicit path, never `git add -A`.
- Never commit `docs/SPEC.md`, secrets, `.env` files, `.npmrc`, build output, or tarballs.
- Small commits using Conventional Commits.
- At the end of each milestone, report: what changed, what is not tested, and any deviation from the spec.
- README, docs, and CLI messages: plain, direct English. No em dashes.

## Naming

- Package and CLI: `orm-preflight`
- Config file: `orm-preflight.config.json`; `package.json` key: `"ormPreflight"`
- Suppression comment: `// preflight safety-assured <rule-id> -- <reason>`

## Owner decisions (SPEC section 12)

Decided:

- Name: `orm-preflight`, public repo at github.com/sikandar100/orm-preflight
- Publishing: unscoped, from my personal npm account
- Package manager: pnpm
- Node support: `engines` `>=20` through 1.x. Dev tooling (Vitest, tsdown, Changesets) needs Node 22 or newer, so tests run on Node 22 and 24, and CI installs the packed tarball on Node 20, 22, and 24 to prove runtime support.
- TypeScript 6.0.x (typescript-eslint does not support 7.x yet)
- MySQL: a preview in 0.1.0 (data-loss and deploy-safety rules, no locking rules); full support in 0.2.0
- Default `postgresVersion`: 16
