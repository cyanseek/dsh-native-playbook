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
  assert.equal(capabilities.find((item) => item.capability === 'web_fetch')?.status, 'disabled')
})

test('fails with a stable code when no task matches', async () => {
  await assert.rejects(
    lookupNativeCapability('quantum banana choreography'),
    (error: unknown) =>
      error instanceof NativePlaybookError && error.code === 'NO_NATIVE_MATCH',
  )
})
