---
'orm-preflight': minor
---

Add `--execute`, which runs each migration's `up()` with a recording query runner to see SQL that is only built at run time. It never touches a database or loads TypeORM, and it refuses to run under `pull_request_target` unless `--allow-untrusted-execute` is given. The GitHub Action stays static.
