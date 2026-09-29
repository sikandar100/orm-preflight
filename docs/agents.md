# Use with AI agents

AI coding agents write migrations fast, and they can write the dangerous ones too. Connect
orm-preflight to your agent, and it checks each migration it writes. The agent then fixes what
orm-preflight finds, before you review anything.

There are three ways to connect it, from most to least automatic:

| Way                                               | Works in                                      | What happens                                                                       |
| ------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| [Claude Code plugin](#claude-code-plugin)         | Claude Code                                   | Every migration Claude writes is checked automatically, and Claude sees the result |
| [MCP server](#mcp-server)                         | Most agents: Cursor, VS Code, Codex, and more | The agent gets tools to check migrations, and calls them when it needs to          |
| [Instructions file](#instructions-for-your-agent) | Any agent that can run a command              | Your project tells the agent to run `npx orm-preflight` after writing a migration  |

You can combine them. Your CI check stays the final safety net either way.

## Claude Code plugin

Install it once, inside Claude Code:

```
/plugin marketplace add sikandar100/orm-preflight
/plugin install orm-preflight@orm-preflight
```

It adds:

- **An automatic check.** Every time Claude writes or edits a migration, orm-preflight checks it
  and hands the result to Claude: each problem with the safe way to fix it, or "no problems
  found". Other files are skipped instantly.
- **A skill** with the safe ways to change a schema.
- **The MCP tools** below.

The plugin uses the orm-preflight installed in your project when there is one, so your config
and version apply. Otherwise it runs the version it was released with.

For example, asked to make a column longer, Claude writes `ALTER COLUMN ... TYPE` instead of
TypeORM's drop and re-add. If it does write a risky migration, it gets the findings right away
and fixes the migration or tells you not to run it.

## MCP server

`orm-preflight mcp` runs orm-preflight as an [MCP](https://modelcontextprotocol.io) server,
the standard way to give an agent new tools. The command is the same everywhere:

```sh
npx -y orm-preflight mcp
```

The agent gets three tools. They only read files: they never run a migration or connect to a
database.

| Tool               | What the agent gets                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `check_migrations` | The findings for some files, the whole project, or the migrations changed since a git ref, such as `origin/main` |
| `explain_rule`     | A rule's full documentation                                                                                      |
| `list_rules`       | Every rule with its category and default severity                                                                |

### Setup for each agent

Each setup links to the app's own documentation. If a snippet here stops working, the linked
docs have the current setup.

#### Claude Code

```sh
claude mcp add orm-preflight -- npx -y orm-preflight mcp
```

Add `--scope project` to save it in `.mcp.json` and share it with your team.
[Docs](https://code.claude.com/docs/en/mcp)

#### Cursor

In `.cursor/mcp.json` in your project, or `~/.cursor/mcp.json` for all projects:

```json
{
  "mcpServers": {
    "orm-preflight": { "type": "stdio", "command": "npx", "args": ["-y", "orm-preflight", "mcp"] }
  }
}
```

[Docs](https://cursor.com/docs/context/mcp)

#### VS Code (GitHub Copilot)

In `.vscode/mcp.json` in your project. Note the top-level key is `servers`:

```json
{
  "servers": {
    "orm-preflight": { "type": "stdio", "command": "npx", "args": ["-y", "orm-preflight", "mcp"] }
  }
}
```

[Docs](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)

#### OpenAI Codex

```sh
codex mcp add orm-preflight -- npx -y orm-preflight mcp
```

Or in `~/.codex/config.toml`:

```toml
[mcp_servers.orm-preflight]
command = "npx"
args = ["-y", "orm-preflight", "mcp"]
```

[Docs](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

#### Gemini CLI

In `.gemini/settings.json` in your project, or `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "orm-preflight": { "command": "npx", "args": ["-y", "orm-preflight", "mcp"] }
  }
}
```

[Docs](https://geminicli.com/docs/tools/mcp-server/)

#### Claude Desktop

In Settings, then Developer, then Edit Config, add the server below, then quit and restart the
app. Claude Desktop does not start in your project folder, so tell Claude the project's path
when you ask it to check migrations.

```json
{
  "mcpServers": {
    "orm-preflight": { "command": "npx", "args": ["-y", "orm-preflight", "mcp"] }
  }
}
```

[Docs](https://modelcontextprotocol.io/docs/develop/connect-local-servers)

#### Devin Desktop (formerly Windsurf)

```sh
devin mcp add -s project orm-preflight -- npx -y orm-preflight mcp
```

This saves it in `.devin/mcp_config.json`, with the same `mcpServers` shape as Cursor.
[Docs](https://docs.devin.ai/cli/extensibility/mcp/configuration)

#### JetBrains Junie

In `.junie/mcp/mcp.json` in your project, or `~/.junie/mcp/mcp.json`, with the same
`mcpServers` shape as Claude Desktop. For JetBrains AI Assistant, paste the same JSON in
Settings, then Tools, then AI Assistant, then Model Context Protocol (MCP).
[Docs](https://junie.jetbrains.com/docs/junie-cli-mcp-configuration.html)

#### Zed

In Zed's `settings.json`. Note the top-level key is `context_servers`:

```json
{
  "context_servers": {
    "orm-preflight": { "command": "npx", "args": ["-y", "orm-preflight", "mcp"], "env": {} }
  }
}
```

[Docs](https://zed.dev/docs/ai/mcp)

### Good to know

- **Your agent may ask you once to allow the tools.** They are marked read-only.
- **Defaults:** flags after `mcp` set them, for example `npx -y orm-preflight mcp --dialect mysql`.
  The project's `orm-preflight.config.json` is used as well.
- **MySQL:** install `orm-preflight` and `node-sql-parser` in the project, and use
  `npx orm-preflight mcp` without `-y`, so the MySQL parser is found.
- **Suppressions:** the server tells the agent never to add a suppression comment unless you
  agree to it.

## Instructions for your agent

Most agents read an instructions file from your project. Add this to it, so the agent checks
its migrations even without MCP:

```md
## Database migrations

After you write or change a database migration, check it with orm-preflight:
`npx orm-preflight <path to the migration>`, or the `check_migrations` MCP tool.
Fix each finding the safe way it describes, or explain why it is safe here.
Never add a `preflight safety-assured` comment unless I agree to it.
```

Where it goes:

| Agent                                                 | File                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| Codex, Cursor, GitHub Copilot, Junie, Zed, and others | [`AGENTS.md`](https://agents.md/) in the project root                          |
| Claude Code                                           | `CLAUDE.md` (Claude Code reads `AGENTS.md` only when there is no `CLAUDE.md`)  |
| Cursor project rules                                  | A `.mdc` file in `.cursor/rules/`, with `alwaysApply: true` in its frontmatter |
| GitHub Copilot                                        | `.github/copilot-instructions.md`                                              |
| Gemini CLI                                            | `GEMINI.md`                                                                    |
