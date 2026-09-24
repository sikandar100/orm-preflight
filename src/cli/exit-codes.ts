/** Process exit codes. Public API: do not change the values. */
export const ExitCode = {
  /** No errors, and warnings within --max-warnings. */
  Ok: 0,
  /** Lint errors, or warnings over the limit. */
  LintFailed: 1,
  /** Usage, config, or internal error. */
  UsageOrInternalError: 2,
} as const

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode]
