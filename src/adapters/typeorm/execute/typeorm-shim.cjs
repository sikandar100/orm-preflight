// Stands in for the `typeorm` package while --execute runs a migration. Migrations import
// schema classes such as TableColumn from it. Here each class only keeps the options it was
// given, which is exactly what the static extractor reads from `new TableColumn({ ... })`.
// The real TypeORM, with its own defaults and side effects, is never loaded.
'use strict'

/**
 * @param {string} name
 * @returns {new (options?: object) => object}
 */
function schemaClass(name) {
  /**
   * @this {Record<string, unknown>}
   * @param {unknown} options
   */
  const Class = function (options) {
    if (options !== null && typeof options === 'object') Object.assign(this, options)
  }
  Object.defineProperty(Class, 'name', { value: name })
  return /** @type {new (options?: object) => object} */ (/** @type {unknown} */ (Class))
}

const names = [
  'Table',
  'TableColumn',
  'TableIndex',
  'TableForeignKey',
  'TableUnique',
  'TableCheck',
  'TableExclusion',
]

for (const name of names) module.exports[name] = schemaClass(name)
