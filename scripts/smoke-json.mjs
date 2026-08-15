#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const run = spawnSync(
  process.execPath,
  [join(root, 'dist', 'cli.js'), 'lookup', 'run tests in background', '--json'],
  { encoding: 'utf8' },
)
const help = spawnSync(process.execPath, [join(root, 'dist', 'cli.js'), '--help'], {
  encoding: 'utf8',
})
const version = spawnSync(process.execPath, [join(root, 'dist', 'cli.js'), '--version'], {
  encoding: 'utf8',
})

if (run.status !== 0 || help.status !== 0 || version.status !== 0) {
  process.stderr.write(run.stderr || run.stdout || 'CLI JSON smoke failed.\n')
  process.exitCode = 1
} else {
  const parsed = JSON.parse(run.stdout)
  if (parsed.mappingId !== 'background-command' || parsed.externalPluginNeeded !== false) {
    throw new Error('CLI JSON smoke returned the wrong native mapping.')
  }
  if (!help.stdout.startsWith('dsh-native') || version.stdout.trim() !== '0.2.1') {
    throw new Error('CLI help or version smoke failed.')
  }
  process.stdout.write('CLI JSON smoke passed.\n')
}
