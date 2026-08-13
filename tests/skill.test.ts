import assert from 'node:assert/strict'
import { access, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { parse } from 'yaml'
import { loadTaskMap } from '../src/api.js'

const skillRoot = join(process.cwd(), 'skills', 'dsh-native-playbook')

test('keeps the entry Skill concise and routes to focused references', async () => {
  const skill = await readFile(join(skillRoot, 'SKILL.md'), 'utf8')
  assert.ok(Buffer.byteLength(skill) < 6_000)
  assert.match(skill, /references\/quick-map\.md/)
  assert.match(skill, /Only look for an external Skill, plugin, or custom implementation/)
  assert.doesNotMatch(skill, /[A-Za-z]:\\|\/mnt\/|mydoc/i)
})

test('ships at least 15 recipes and every required focused reference', async () => {
  const required = [
    'quick-map.md',
    'coding.md',
    'long-running.md',
    'agents.md',
    'orchestration.md',
    'web.md',
    'sessions.md',
    'safety.md',
    'opt-in.md',
  ]
  const files = await readdir(join(skillRoot, 'references'))
  for (const file of required) assert.ok(files.includes(file), `missing ${file}`)
  const bodies = await Promise.all(
    files.map((file) => readFile(join(skillRoot, 'references', file), 'utf8')),
  )
  const recipeCount = (bodies.join('\n').match(/^## Recipe \d+/gm) ?? []).length
  assert.ok(recipeCount >= 15)
})

test('curated task map covers at least 30 intents and has unique ids', async () => {
  const taskMap = await loadTaskMap()
  assert.ok(taskMap.entries.length >= 30)
  assert.equal(new Set(taskMap.entries.map((entry) => entry.id)).size, taskMap.entries.length)
})

test('SKILL frontmatter is valid and model-invocable by default', async () => {
  const skill = await readFile(join(skillRoot, 'SKILL.md'), 'utf8')
  const frontmatter = skill.match(/^---\n([\s\S]+?)\n---/)?.[1]
  assert.ok(frontmatter)
  const data = parse(frontmatter)
  assert.equal(data.name, 'dsh-native-playbook')
  assert.equal(data['disable-model-invocation'], undefined)
})

test('English and Chinese READMEs expose the same tested command surface', async () => {
  const [english, chinese] = await Promise.all([
    readFile(join(process.cwd(), 'README.md'), 'utf8'),
    readFile(join(process.cwd(), 'README.zh-CN.md'), 'utf8'),
  ])
  const commands = [
    'lookup "<task>"',
    'status --profile <name>',
    'list [--profile <name>]',
    'explain <capability>',
    'doctor [--json]',
    'install --target project|dsh',
  ]
  for (const command of commands) {
    assert.ok(english.includes(command), `English README is missing ${command}`)
    assert.ok(chinese.includes(command), `Chinese README is missing ${command}`)
  }
  await access(join(process.cwd(), 'assets', 'demo.svg'))
})

test('Codex plugin manifest is a thin adapter over the same Skill tree', async () => {
  const manifest = JSON.parse(
    await readFile(join(process.cwd(), '.codex-plugin', 'plugin.json'), 'utf8'),
  )
  assert.equal(manifest.name, 'dsh-native-playbook')
  assert.equal(manifest.version, '0.1.0')
  assert.equal(manifest.skills, './skills/')
  assert.equal(manifest.mcpServers, undefined)
  assert.equal(manifest.apps, undefined)
})
