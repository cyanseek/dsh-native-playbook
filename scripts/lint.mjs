#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const roots = ['src', 'scripts', 'tests']
const extensions = new Set(['.ts', '.mjs'])
const failures = []

for (const root of roots) await walk(root)

if (failures.length > 0) {
  process.stderr.write(`Lint failed:\n- ${failures.join('\n- ')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write('Lint checks passed.\n')
}

async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name)
    if (entry.isDirectory()) await walk(child)
    else if (extensions.has(extname(entry.name))) await check(child)
  }
}

async function check(path) {
  const text = await readFile(path, 'utf8')
  const lines = text.split(/\r?\n/)
  lines.forEach((line, index) => {
    if (/\s+$/.test(line)) failures.push(`${path}:${index + 1} has trailing whitespace`)
    if (line.includes('\t')) failures.push(`${path}:${index + 1} contains a tab`)
  })
  if (path.startsWith('src') && /console\.(?:log|error|warn)/.test(text)) {
    failures.push(`${path} uses console; CLI output must stay explicitly routed`)
  }
}
