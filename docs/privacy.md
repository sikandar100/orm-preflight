# Privacy

orm-preflight runs entirely on your own machine or CI runner. This covers the command line
tool, the GitHub Action, the MCP server, and the Claude Code plugin.

## In short

- It collects nothing about you.
- It sends nothing anywhere: no telemetry, no analytics, no accounts.
- It never connects to your database.

## What it reads

- Your migration files, and your `orm-preflight.config.json` or the `"ormPreflight"` key in
  `package.json`.
- With `--changed-since`, your local git history, to find the migrations a branch changed.
- In the Claude Code plugin, the file Claude just wrote or edited, to see whether it is a
  migration. Other files are not read further.

Migration files normally hold schema changes, not personal data. If yours contain data, such as
seed rows, orm-preflight reads them like any other statement and keeps nothing.

## What it stores

Nothing. The only file it ever writes is the config file that `orm-preflight init` creates when
you run it.

## What goes over the network

orm-preflight itself makes no network requests. Two things around it can:

- **npm:** `npx orm-preflight` and the Claude Code plugin may download the orm-preflight package
  from the npm registry. That is a normal package download, covered by
  [npm's privacy policy](https://docs.npmjs.com/policies/privacy/). No project data is sent.
- **GitHub code scanning:** the GitHub Action uploads its findings to your own repository's
  code scanning only when you set `sarif: true`.

## AI agents

When your AI agent uses orm-preflight, through the plugin or MCP, the findings go back to the
agent like any other tool result. From there, your agent's own terms apply, such as those of
Claude Code or Cursor. orm-preflight adds no data of its own.

## Contact

Questions: open an issue on [GitHub](https://github.com/sikandar100/orm-preflight/issues).
Security problems: see [SECURITY.md](https://github.com/sikandar100/orm-preflight/blob/main/SECURITY.md).
