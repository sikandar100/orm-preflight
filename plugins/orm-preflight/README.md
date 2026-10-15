# orm-preflight plugin for Claude Code

Checks database migrations as Claude writes them, and tells Claude the safe way to make a risky
schema change. Full documentation: https://sikandar100.github.io/orm-preflight/

## What runs by itself

- **The MCP server**, when a Claude Code session starts. It gives Claude the `check_migrations`,
  `explain_rule`, and `list_rules` tools.
- **A hook, after Claude uses Write, Edit, or MultiEdit.** If the file is a migration, it checks
  it and hands the result to Claude. Other files are skipped without running anything.

Both run `scripts/orm-preflight.mjs`, which starts exactly the pinned version
`orm-preflight@1.2.0` through npm's npx, with no shell.

## Network

The first run downloads the pinned package from the npm registry; later runs use npm's cache.
Nothing else uses the network: orm-preflight reads files on your machine, never connects to your
database, and sends nothing anywhere. See the
[privacy policy](https://sikandar100.github.io/orm-preflight/privacy).

## Setting

**Use the project's own orm-preflight** (`use_project_install`), off by default. Turn it on in
`/config` to make the automatic check run the orm-preflight installed in the project folder
(`node_modules/orm-preflight`) instead of the pinned version, for example to use the project's
MySQL parser (`node-sql-parser`). Parent folders are never searched. With it on, the project
decides which version the check runs.

The MCP server always runs the pinned version, because Claude Code passes plugin settings to
hooks only. On MySQL, it cannot load the project's parser. To use the MCP tools on MySQL, add your
project's own install instead: `claude mcp add orm-preflight -- npx orm-preflight mcp`.

## What the skill adds

The `safe-migrations` skill teaches Claude the safe ways to change a schema, and never to add a
suppression comment without your agreement.
