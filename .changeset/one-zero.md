---
'orm-preflight': major
---

orm-preflight 1.0.

Breaking change: five rules that shipped as warnings in 0.2 are now errors, as the rule catalogue always intended. If your CI passed with warnings before, it may now fail on these:

- `require-not-valid-check`
- `require-concurrent-unique`
- `no-blocking-maintenance`
- `enum-value-used-in-same-transaction`
- `no-edit-applied-migration`

To keep one as a warning, set it in your config, for example `{ "rules": { "require-not-valid-check": "warn" } }`.

The GitHub Action now has a `v1` tag that follows every 1.x release: `uses: sikandar100/orm-preflight@v1`.
