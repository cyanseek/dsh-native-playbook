#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const checks = [
  [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(root, 'tsconfig.json')],
  [join(root, 'scripts', 'validate-skill.mjs')],
  [join(root, 'scripts', 'validate-plugin.mjs')],
  [join(root, 'scripts', 'validate-dsh-plugin.mjs')],
  [join(root, 'scripts', 'verify-upstream.mjs')],
]

for (const [entry, ...args] of checks) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
