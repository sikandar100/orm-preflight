---
'orm-preflight': minor
---

New Claude Code plugin. Install it with `/plugin marketplace add sikandar100/orm-preflight` and `/plugin install orm-preflight@orm-preflight`. Every time Claude writes or edits a migration, orm-preflight checks it and hands the result back to Claude, which then fixes the migration or explains why it is safe. The plugin also adds a skill with the safe ways to change a schema, and the MCP tools.
