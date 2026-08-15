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
  const frontmatter = skill.match(/^---\r?\n([\s\S]+?)\r?\n---/)?.[1]
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
    'plan <capability> --profile <name>',
    'activate <capability> --profile <name>',
    'deactivate <capability> --profile <name>',
    'verify <capability> --profile <name>',
  ]
  for (const command of commands) {
    assert.ok(english.includes(command), `English README is missing ${command}`)
    assert.ok(chinese.includes(command), `Chinese README is missing ${command}`)
  }
  const installCommands = [
    'dsh plugin --profile web add github:cyanseek/dsh-native-playbook',
    'dsh plugin --profile web remove dsh-native-playbook',
  ]
  for (const command of installCommands) {
    assert.ok(english.includes(command), `English README is missing ${command}`)
    assert.ok(chinese.includes(command), `Chinese README is missing ${command}`)
  }
  const internalDetails = [
    /ctx\.tools/,
    /cordis\.patch\.yml/,
    /generated\/upstream\.json/,
    /dsh\.bundle\.patch/,
  ]
  for (const pattern of internalDetails) {
    assert.doesNotMatch(english, pattern)
    assert.doesNotMatch(chinese, pattern)
  }
  assert.doesNotMatch(english, /approve-builds|allowBuilds|run the install again/i)
  assert.doesNotMatch(chinese, /approve-builds|allowBuilds|重新安装|重新运行安装/i)
  assert.match(english, /not a separate agent\s+runtime/i)
  assert.match(chinese, /不是独立的\s*Agent runtime/i)
  assert.match(english, /Unlock the DeepSeek Harness you already installed/)
  assert.match(english, /Use what DeepSeek Harness already ships before building more/)
  assert.match(english, /That's it\. Use DSH normally\./)
  assert.match(chinese, /把你已经安装的 DeepSeek Harness 真正用起来/)
  assert.match(chinese, /先用好 DeepSeek Harness 已经提供的能力，再考虑重复开发/)
  assert.match(chinese, /到这里就结束了。之后正常使用 DSH。/)
  await access(join(process.cwd(), 'assets', 'demo.svg'))
})

test('release notes preserve every v0.1 public surface in the compatibility matrix', async () => {
  const changelog = await readFile(join(process.cwd(), 'CHANGELOG.md'), 'utf8')
  for (const surface of ['native_capability', 'dsh-native lookup', 'dsh-native status', 'Agent Skill', 'Node API']) {
    assert.ok(changelog.includes(surface), `compatibility matrix is missing ${surface}`)
  }
})

test('preserves the v0.1 Node API while adding activation APIs', async () => {
  const api = await import('../src/api.js')
  const preserved = [
    'loadTaskMap',
    'loadUpstreamSnapshot',
    'lookupNativeCapability',
    'listNativeCapabilities',
    'explainNativeCapability',
    'inspectDshProfile',
    'parseProfileConfig',
    'parseRows',
    'installSkill',
  ]
  const added = [
    'planNativeActivation',
    'activateNativeCapability',
    'deactivateNativeCapability',
    'verifyNativeCapability',
  ]
  for (const name of [...preserved, ...added]) {
    assert.equal(typeof api[name as keyof typeof api], 'function', `missing Node API export ${name}`)
  }
})

test('Codex plugin manifest is a thin adapter over the same Skill tree', async () => {
  const manifest = JSON.parse(
    await readFile(join(process.cwd(), '.codex-plugin', 'plugin.json'), 'utf8'),
  )
  assert.equal(manifest.name, 'dsh-native-playbook')
  assert.equal(manifest.version, '0.2.1')
  assert.equal(manifest.skills, './skills/')
  assert.equal(manifest.mcpServers, undefined)
  assert.equal(manifest.apps, undefined)
})

test('ships prebuilt consumer artifacts with no install-time build hook', async () => {
  const manifest = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8'))
  assert.equal(manifest.version, '0.2.1')
  assert.equal(manifest.scripts.prepare, undefined)
  assert.equal(manifest.scripts.install, undefined)
  assert.equal(manifest.scripts.postinstall, undefined)
  assert.ok(manifest.files.includes('dist'))
  assert.ok(manifest.files.includes('activation-recipes'))
  assert.ok(manifest.files.includes('llms.txt'))
  assert.ok(manifest.files.includes('scripts/impact-metrics.mjs'))
  for (const artifact of ['api.js', 'plugin.js', 'session-query.js', 'cli.js']) {
    await access(join(process.cwd(), 'dist', artifact))
  }
})
