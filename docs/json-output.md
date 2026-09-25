# JSON output

`orm-preflight --format json` prints one JSON document. Its shape is public API: fields are
only added in minor releases, and renamed or removed only in a major release.

Every field is always present. Values that do not apply are `null`, never missing. Keys
always appear in the order shown, and findings are sorted by file, line, column, and rule ID,
so the same input always gives byte-identical output.

```json
{
  "version": "0.1.0",
  "summary": {
    "errors": 1,
    "warnings": 0,
    "suppressed": 1,
    "files": 2,
    "migrations": 2
  },
  "findings": [
    {
      "ruleId": "no-drop-column",
      "severity": "error",
      "category": "data-loss",
      "file": "src/migrations/1727600000000-DropBio.ts",
      "line": 5,
      "column": 30,
      "message": "\"users\".\"bio\" is dropped, which deletes every value in it.",
      "why": "Dropping a column deletes its data immediately. ...",
      "safeAlternative": "Remove the property from the entity and deploy that first. ...",
      "docsUrl": "https://github.com/sikandar100/orm-preflight/blob/main/docs/rules/no-drop-column.md",
      "suppressed": null
    }
  ]
}
```

## Top level

| Field      | Type   | Meaning                                             |
| ---------- | ------ | --------------------------------------------------- |
| `version`  | string | The orm-preflight version that produced the output. |
| `summary`  | object | Counts, described below.                            |
| `findings` | array  | Every finding, including suppressed ones.           |

## `summary`

| Field        | Type   | Meaning                                                        |
| ------------ | ------ | -------------------------------------------------------------- |
| `errors`     | number | Findings with severity `error` that are not suppressed.        |
| `warnings`   | number | Findings with severity `warn` that are not suppressed.         |
| `suppressed` | number | Findings suppressed with a `preflight safety-assured` comment. |
| `files`      | number | Migration files read.                                          |
| `migrations` | number | Migrations checked, after `startAfter` is applied.             |

## Each finding

| Field             | Type                             | Meaning                                                                                                  |
| ----------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ruleId`          | string                           | The rule that reported it. Adapter rules are prefixed, such as `typeorm/no-enum-recreate`.               |
| `severity`        | `"error"` or `"warn"`            | The severity after config overrides.                                                                     |
| `category`        | string                           | `data-loss`, `locking`, `deploy-safety`, or `correctness`.                                               |
| `file`            | string                           | Path relative to the project root, with forward slashes.                                                 |
| `line`, `column`  | number                           | 1-based position of the statement in the file. For SQL, the position of the statement inside the string. |
| `message`         | string                           | What happens.                                                                                            |
| `why`             | string                           | Why it happens.                                                                                          |
| `safeAlternative` | string or `null`                 | How to make the change safely.                                                                           |
| `docsUrl`         | string                           | The rule's documentation.                                                                                |
| `suppressed`      | `null` or `{ "reason": string }` | Set when a valid suppression comment applies, with its reason.                                           |

Exit codes do not count suppressed findings. See the README for exit codes.
