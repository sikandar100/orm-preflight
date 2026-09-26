---
'orm-preflight': minor
---

Add `require-down` (warn), which reports an empty or missing `down()`, and `typeorm/no-enum-recreate` (warn), which reports TypeORM 0.3's enum change by recreating the type. MySQL is no longer a preview: the data-loss, deploy-safety, and correctness rules apply. Database-type checks now follow same-file helpers that receive the type as a parameter or return it.
