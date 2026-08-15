#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises'
import { parse } from 'yaml'

const failures = []
const [manifestText, patchText, source] = await Promise.all([
  readFile('package.json', 'utf8'),
  readFile('cordis.patch.yml', 'utf8'),
  readFile('src/plugin.ts', 'utf8'),
])
const manifest = JSON.parse(manifestText)
const patch = parse(patchText)

if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') {
  failures.push('package.json must declare dsh.bundle.patch as ./cordis.patch.yml')
}
if (!manifest.files?.includes('cordis.patch.yml')) {
  failures.push('the published file list must include cordis.patch.yml')
}
if (manifest.exports?.['./plugin']?.import !== './dist/plugin.js') {
  failures.push('package exports must expose ./plugin from ./dist/plugin.js')
}
if (!Array.isArray(patch) || patch.length !== 1 || patch[0]?.insert?.[0]?.name !== 'dsh-native-playbook/plugin') {
  failures.push('cordis.patch.yml must insert dsh-native-playbook/plugin')
}
for (const required of [
  "export const name = 'dsh-native-playbook'",
  "export const inject = ['tools', 'systemPrompt']",
  'export function apply(',
  "name: 'native_capability'",
]) {
  if (!source.includes(required)) failures.push(`src/plugin.ts is missing ${required}`)
}
if (manifest.scripts?.prepare || manifest.scripts?.install || manifest.scripts?.postinstall) {
  failures.push('consumer lifecycle build scripts must be absent')
}
if (!manifest.files?.includes('activation-recipes')) {
  failures.push('the published file list must include activation-recipes')
}
if (manifest.exports?.['./session-query']?.import !== './dist/session-query.js') {
  failures.push('package exports must expose the reviewed session-query wrapper')
}
if (/export\s+default\b/.test(source)) {
  failures.push('the DSH function plugin must not have a default export')
}
try {
  await access('dist/plugin.js')
} catch {
  failures.push('dist/plugin.js is missing; run pnpm build first')
}

if (failures.length > 0) {
  process.stderr.write(`DSH plugin validation failed:\n- ${failures.join('\n- ')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write('Validated installable DSH plugin bundle.\n')
}
