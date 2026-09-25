/**
 * A problem with how orm-preflight was called or configured, as opposed to a finding in
 * a migration. The CLI prints the message and exits with code 2.
 */
export class UsageError extends Error {
  readonly exitCode = 2
  constructor(message: string) {
    super(message)
    this.name = 'UsageError'
  }
}

export class ConfigError extends UsageError {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}
