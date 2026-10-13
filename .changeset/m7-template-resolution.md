---
'orm-preflight': minor
---

orm-preflight now reads `${...}` in SQL templates when the value is known in the same file, instead of reporting the statement as unanalyzable. It follows `const` strings, numbers, arrays, and objects, static properties of the class such as `Migration.TABLES`, `.join()` and `.replace()` on known values, and local functions that return a string. A `for (const x of ...)` loop over a known array is read once per item.

This removes false `require-concurrent-index` findings on tables created with a template, and shows real findings that were hidden in loops. An unanalyzable message now names the `${...}` that is not known, and why.
