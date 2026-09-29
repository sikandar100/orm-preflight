---
'orm-preflight': minor
---

New `orm-preflight mcp` command: runs orm-preflight as an MCP server, so AI coding agents such as Claude Code, Cursor, and VS Code can check migrations as they write them. Add it with `claude mcp add orm-preflight -- npx -y orm-preflight mcp`, or the same command in your agent's MCP settings.

The agent gets three read-only tools: `check_migrations`, `explain_rule`, and `list_rules`. They never run migration code. The server works with clients on the current MCP protocol (2026-07-28) and on the earlier versions most clients still use.
