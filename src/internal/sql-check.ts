/**
 * Not part of the public API. Built as dist/internal-sql-check.{mjs,cjs} so the installed
 * package smoke test can prove the SQL parsers load (including WebAssembly) on every
 * supported Node version and operating system.
 */
export { loadParser } from '../sql/index.js'
