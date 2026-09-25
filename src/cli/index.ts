#!/usr/bin/env node
import pc from 'picocolors'
import { run } from './run.js'

// A closed pipe, as in `orm-preflight | head`, is not an error.
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code !== 'EPIPE') throw error
})

process.exitCode = await run(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  // Honors NO_COLOR, FORCE_COLOR, and whether stdout is a terminal.
  color: pc.isColorSupported,
})
