#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function main() {
  const path = join(root, '.codex-plugin', 'plugin.json')
  const [manifest, packageJson] = await Promise.all([
    readFile(path, 'utf8').then((text) => JSON.parse(text)),
    readFile(join(root, 'package.json'), 'utf8').then((text) => JSON.parse(text)),
  ])
  const failures = []

  if (manifest.name !== 'dsh-native-playbook') failures.push('name must match the plugin directory')
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? '')) failures.push('version must be strict semver')
  if (manifest.version !== packageJson.version) failures.push('version must match package.json')
  if (typeof manifest.description !== 'string' || manifest.description.length < 20) {
    failures.push('description is missing or too short')
  }
  if (manifest.author?.name !== 'cyanseek') failures.push('author.name must identify the publisher')
  if (manifest.skills !== './skills/') failures.push('skills must point to ./skills/')
  if (manifest.apps || manifest.mcpServers || manifest.hooks) {
    failures.push('undeclared runtime surfaces must be omitted')
  }
  for (const field of ['displayName', 'shortDescription', 'longDescription', 'developerName', 'category']) {
    if (typeof manifest.interface?.[field] !== 'string' || manifest.interface[field].length === 0) {
      failures.push(`interface.${field} is required`)
    }
  }
  const prompts = manifest.interface?.defaultPrompt
  if (!Array.isArray(prompts) || prompts.length === 0 || prompts.length > 3) {
    failures.push('interface.defaultPrompt must contain one to three prompts')
  } else if (prompts.some((prompt) => typeof prompt !== 'string' || prompt.length > 128)) {
    failures.push('every default prompt must be a string of at most 128 characters')
  }
  await access(join(root, 'skills', 'dsh-native-playbook', 'SKILL.md'))

  if (failures.length > 0) throw new Error(`INVALID_PLUGIN:\n- ${failures.join('\n- ')}`)
  process.stdout.write('Validated Codex skill-only plugin manifest.\n')
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
