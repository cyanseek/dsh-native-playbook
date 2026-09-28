import assert from 'node:assert/strict'
import test from 'node:test'
import {
  listNativeCapabilities,
  lookupNativeCapability,
  NativePlaybookError,
} from '../src/api.js'

const cases = [
  ['run tests in background', 'background-command', ['bash', 'job_output']],
  ['find all symbol references', 'symbol-navigation', ['lsp', 'grep']],
  ['let another agent investigate', 'delegate-investigation', ['subagent']],
  ['search the web', 'search-web', ['web_search']],
  [
    'build a custom plugin for background jobs',
    'avoid-background-plugin',
    ['bash', 'job_output', 'job_kill'],
  ],
] as const

for (const [task, mappingId, capabilities] of cases) {
  test(`routes '${task}' to native DSH`, async () => {
    const result = await lookupNativeCapability(task)
    assert.equal(result.mappingId, mappingId)
    assert.deepEqual(
      result.recommendations.map((item) => item.capability),
      capabilities,
    )
    assert.equal(result.externalPluginNeeded, false)
    assert.match(result.upstreamCommit, /^[a-f0-9]{40}$/)
  })
}

test('routes a Chinese background-task request', async () => {
  const result = await lookupNativeCapability('后台运行一个耗时测试')
  assert.equal(result.mappingId, 'background-command')
  assert.equal(result.recommendations[0]?.capability, 'bash')
})

test('lists the generated native tool catalog', async () => {
  const capabilities = await listNativeCapabilities()
  assert.ok(capabilities.length >= 40)
  assert.ok(capabilities.some((item) => item.capability === 'subagent_fork'))
  assert.deepEqual(
    capabilities.find((item) => item.capability === 'ask_user_question')?.requires,
    ['tools', 'userQuestions'],
  )
  assert.equal(capabilities.find((item) => item.capability === 'web_fetch')?.status, 'ready')
  const fetchResult = await lookupNativeCapability('fetch a web page')
  assert.equal(fetchResult.recommendations[0]?.status, 'ready')
  assert.equal(fetchResult.recommendations[0]?.lifecycle.operational, 'unknown')
})

test('fails with a stable code when no task matches', async () => {
  await assert.rejects(
    lookupNativeCapability('quantum banana choreography'),
    (error: unknown) =>
      error instanceof NativePlaybookError && error.code === 'NO_NATIVE_MATCH',
  )
})

test('maps new release capabilities without treating optional browser services as installed', async () => {
  for (const [task, capability] of [
    ['manage plugins', 'plugin_manager'],
    ['list mcp resources', 'list_mcp_resources'],
    ['read mcp resource', 'read_mcp_resource'],
    ['update a schedule', 'schedule_update'],
    ['load workspace dependencies', 'load_workspace_dependencies'],
    ['interact with a web page', 'stagehand_observe'],
  ]) {
    const result = await lookupNativeCapability(task!)
    assert.equal(result.recommendations[0]?.capability, capability)
  }
  const browser = await lookupNativeCapability('interact with a web page')
  assert.equal(browser.recommendations[0]?.lifecycle.operational, false)
})
