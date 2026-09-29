---
'orm-preflight': patch
---

Fix the GitHub Action's `mysql: true` input. The MySQL parser was never installed, so every MySQL check in the Action stopped with an internal error. The action now installs orm-preflight and the parser with npm, and CI runs it on a MySQL project.

A missing MySQL parser is now reported as a plain message with exit code 2, instead of an internal error with a stack trace.
