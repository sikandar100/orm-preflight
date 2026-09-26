---
'orm-preflight': minor
---

Add six PostgreSQL locking rules: `require-not-valid-check`, `require-concurrent-unique`, `require-concurrent-index-drop`, `no-blocking-maintenance`, and `enum-value-used-in-same-transaction` (warn), and the opt-in `require-lock-timeout` (off). `ALTER COLUMN ... SET DEFAULT` is now analyzed.
