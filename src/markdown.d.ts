/** Markdown files are imported as text (tsdown `loader`, and a Vitest plugin in tests). */
declare module '*.md' {
  const text: string
  export default text
}
