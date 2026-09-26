import { readFileSync } from 'node:fs'
import AjvDraft04 from 'ajv-draft-04'
import ajvFormats from 'ajv-formats'

// Both packages are CommonJS with the export on `default`, which NodeNext types expose as a
// property of the module.
const ajv = new AjvDraft04.default({ allErrors: true, strict: false })
ajvFormats.default(ajv)

/** Validates against the official OASIS SARIF 2.1.0 schema (errata 01), vendored in fixtures. */
export const validateSarif = ajv.compile(
  JSON.parse(
    readFileSync(new URL('./fixtures/sarif-schema-2.1.0.json', import.meta.url), 'utf8'),
  ) as object,
)
