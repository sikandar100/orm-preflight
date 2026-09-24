import { build } from 'tsdown'

/** Builds dist/ once per test run, so end-to-end tests never run against a stale build. */
export default async function setup(): Promise<void> {
  await build({ logLevel: 'warn' })
}
