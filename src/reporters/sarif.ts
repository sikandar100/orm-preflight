import type { LintResult } from '../lint.js'
import type { Category, Severity } from '../rules/types.js'

/** What SARIF needs to know about a rule. */
export interface SarifRule {
  id: string
  category: Category
  defaultSeverity: Severity
  docsUrl: string
  /** One sentence, from the rule's documentation. */
  summary: string
}

export interface SarifOptions {
  /** Every rule, so code scanning can show rule help for each result. */
  rules: readonly SarifRule[]
  /** The linted directory relative to the repository root, or ''. See GithubOptions. */
  pathPrefix: string
}

const INFORMATION_URI = 'https://github.com/sikandar100/orm-preflight'

/**
 * SARIF 2.1.0, for GitHub code scanning and other SARIF viewers. Suppressed findings are
 * kept as results with an in-source suppression and its reason, as SARIF intends.
 */
export function formatSarif(result: LintResult, options: SarifOptions): string {
  const index = new Map(options.rules.map((r, i) => [r.id, i]))
  const sarif = {
    $schema:
      'https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'orm-preflight',
            version: result.version,
            informationUri: INFORMATION_URI,
            rules: options.rules.map((r) => ({
              id: r.id,
              shortDescription: { text: r.summary },
              helpUri: r.docsUrl,
              help: { text: `${r.summary} See ${r.docsUrl}` },
              defaultConfiguration: {
                enabled: r.defaultSeverity !== 'off',
                level: r.defaultSeverity === 'error' ? 'error' : 'warning',
              },
              properties: { category: r.category, tags: [r.category] },
            })),
          },
        },
        results: result.findings.map((f) => {
          const text = [f.message, `Why: ${f.why}`]
          if (f.safeAlternative !== null) text.push(`Safe: ${f.safeAlternative}`)
          const ruleIndex = index.get(f.ruleId)
          return {
            ruleId: f.ruleId,
            ...(ruleIndex === undefined ? {} : { ruleIndex }),
            level: f.severity === 'error' ? 'error' : 'warning',
            message: { text: text.join(' ') },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: {
                    uri: options.pathPrefix === '' ? f.file : `${options.pathPrefix}/${f.file}`,
                    uriBaseId: '%SRCROOT%',
                  },
                  region: { startLine: f.line, startColumn: f.column },
                },
              },
            ],
            ...(f.suppressed === null
              ? {}
              : { suppressions: [{ kind: 'inSource', justification: f.suppressed.reason }] }),
          }
        }),
        columnKind: 'utf16CodeUnits',
      },
    ],
  }
  return `${JSON.stringify(sarif, null, 2)}\n`
}
