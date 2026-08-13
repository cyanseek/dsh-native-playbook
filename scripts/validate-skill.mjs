#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const skillRoot = join(root, 'skills', 'dsh-native-playbook')

async function main() {
  const skill = await readFile(join(skillRoot, 'SKILL.md'), 'utf8')
  const frontmatterMatch = skill.match(/^---\r?\n([\s\S]+?)\r?\n---(?:\r?\n|$)/)
  if (!frontmatterMatch?.[1]) throw new Error('INVALID_SKILL: SKILL.md has no YAML frontmatter.')
  const frontmatter = parse(frontmatterMatch[1])
  if (frontmatter.name !== 'dsh-native-playbook') {
    throw new Error('INVALID_SKILL: name must be dsh-native-playbook.')
  }
  if (typeof frontmatter.description !== 'string' || frontmatter.description.length < 80) {
    throw new Error('INVALID_SKILL: description must explain the native-first trigger.')
  }

  const referenced = [...skill.matchAll(/references\/([a-z-]+\.md)/g)].map((match) => match[1])
  const available = new Set(await readdir(join(skillRoot, 'references')))
  for (const file of referenced) {
    if (!available.has(file)) throw new Error(`INVALID_SKILL: missing reference ${file}.`)
  }
  const referenceText = (
    await Promise.all([...available].map((file) => readFile(join(skillRoot, 'references', file), 'utf8')))
  ).join('\n')
  const recipeCount = (referenceText.match(/^## Recipe \d+/gm) ?? []).length
  if (recipeCount < 15) throw new Error(`INVALID_SKILL: expected 15 recipes, found ${recipeCount}.`)
  if (/mydoc|\/mnt\/|[A-Za-z]:\\/i.test(`${skill}\n${referenceText}`)) {
    throw new Error('INVALID_SKILL: public Skill contains an internal path or Local-document reference.')
  }
  process.stdout.write(`Validated dsh-native-playbook Skill with ${recipeCount} recipes.\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
