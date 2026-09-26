---
'orm-preflight': minor
---

Add `--changed-since <git-ref>` to check only the migrations a branch adds or changes, and the `no-edit-applied-migration` rule (warn), which reports an edit to a migration that already exists on the base branch.
