import assert from 'node:assert/strict'
import test from 'node:test'
import {
  inspectDshProfile,
  loadUpstreamSnapshot,
  NativePlaybookError,
  parseProfileConfig,
  parseRows,
} from '../src/api.js'

const profile = `
- insert:
    - id: tool-bash
      name: '@deepseek-ai/dsh-tool-bash'
      disabled: !!js process.platform === 'win32'
    - id: tool-jobs
      name: '@deepseek-ai/dsh-tool-jobs'
    - id: tool-lsp
      name: '@deepseek-ai/dsh-tool-lsp'
    - id: tool-terminal
      name: '@deepseek-ai/dsh-tool-terminal'
    - id: terminal-bash
      name: '@deepseek-ai/dsh-terminal-bash'
    - id: tool-web
      name: '@deepseek-ai/dsh-tool-web'
      config:
        fetch: false
    - id: web-search
      name: '@deepseek-ai/dsh-web-search-deepseek'
    - id: tools
      name: '@deepseek-ai/dsh-tools'
`

test('parses composed DSH rows without evaluating !!js', () => {
  const rows = parseRows(profile)
  assert.equal(rows.length, 8)
  assert.equal(rows[0]?.id, 'tool-bash')
  assert.equal(rows[0]?.disabled, 'platform-dependent')
  assert.equal(rows[1]?.package, '@deepseek-ai/dsh-tool-jobs')
})

test('derives capability status from effective rows and providers', async () => {
  const snapshot = await loadUpstreamSnapshot()
  const result = parseProfileConfig('fixture', profile, snapshot)
  assert.equal(result.capabilityStatuses.bash, 'platform-dependent')
  assert.equal(result.capabilityStatuses.job_output, 'ready')
  assert.equal(result.capabilityStatuses.lsp, 'requires-provider')
  assert.equal(result.capabilityStatuses.terminal_open, 'ready')
  assert.equal(result.capabilityStatuses.web_search, 'ready')
  assert.equal(result.capabilityStatuses.web_fetch, 'disabled')
  assert.equal(result.capabilityStatuses.run_code, 'opt-in')
  assert.equal(result.capabilityLifecycles.lsp?.mounted, true)
  assert.equal(result.capabilityLifecycles.lsp?.providerReady, false)
  assert.equal(result.capabilityLifecycles.lsp?.operational, false)
})

test('requires both the official session tool and a search-ready query provider', async () => {
  const snapshot = await loadUpstreamSnapshot()
  const active = parseProfileConfig('fixture', `${profile}
    - id: session-query-sqlite
      name: '@deepseek-ai/dsh-session-query-sqlite'
      config:
        path: ':memory:'
        openAt: first-search
    - id: tool-session-query
      name: 'dsh-native-playbook/session-query'
`, snapshot, ['session_search'])
  assert.equal(active.capabilityStatuses.session_search, 'ready')
  assert.equal(active.capabilityLifecycles.session_search?.providerReady, true)
  assert.equal(active.capabilityLifecycles.session_search?.visible, true)
  assert.equal(active.capabilityLifecycles.session_search?.operational, true)
})

test('rejects unsafe profile names before executing DSH', async () => {
  await assert.rejects(
    inspectDshProfile({ profile: 'web;echo unsafe', dshCommand: 'missing-dsh' }),
    (error: unknown) =>
      error instanceof NativePlaybookError && error.code === 'PROFILE_NOT_FOUND',
  )
})

test('requires the selected anonymous HTTP provider before declaring web fetch ready', async () => {
  const snapshot = await loadUpstreamSnapshot()
  const enabled = profile.replace('fetch: false', 'fetch: true')
  const router = `
    - id: web
      name: '@deepseek-ai/dsh-web'
      config:
        fetchProvider: http
`
  const provider = `
    - id: web-fetch-http
      name: '@deepseek-ai/dsh-web-fetch-http'
`
  for (const source of [enabled, enabled + router, enabled + provider,
    enabled + router + provider + '      disabled: true\n',
    enabled + router.replace('fetchProvider: http', 'fetchProvider: custom') + provider]) {
    const result = parseProfileConfig('fixture', source, snapshot, ['web_fetch'])
    assert.equal(result.capabilityStatuses.web_fetch, 'requires-provider')
    assert.equal(result.capabilityLifecycles.web_fetch?.operational, false)
  }
  const result = parseProfileConfig('fixture', enabled + router + provider, snapshot, ['web_fetch'])
  assert.equal(result.capabilityStatuses.web_fetch, 'ready')
  assert.equal(result.capabilityLifecycles.web_fetch?.operational, true)
})

test('distinguishes plugin manager service from its disabled model-facing tool', async () => {
  const snapshot = await loadUpstreamSnapshot()
  const source = `
- id: plugin-manager
  name: '@deepseek-ai/dsh-plugin-manager'
- id: tool-plugin-manager
  name: '@deepseek-ai/dsh-plugin-manager/tools'
  disabled: true
`
  assert.equal(parseProfileConfig('fixture', source, snapshot).capabilityStatuses.plugin_manager, 'disabled')
  assert.equal(parseProfileConfig('fixture', source.replace('disabled: true', 'disabled: false'), snapshot).capabilityStatuses.plugin_manager, 'ready')
})

test('recognizes PTC mode and keeps unevaluated conditions unverified', async () => {
  const snapshot = await loadUpstreamSnapshot()
  const source = `
- id: tools
  name: '@deepseek-ai/dsh-tools'
  config:
    mode: ptc
- id: tool-plugin-manager
  name: '@deepseek-ai/dsh-plugin-manager/tools'
  disabled: !!js '!ctx.get("profileContext")'
`
  const inspected = parseProfileConfig('fixture', source, snapshot)
  assert.equal(inspected.capabilityStatuses.run_code, 'ready')
  assert.notEqual(inspected.capabilityLifecycles.plugin_manager?.operational, true)
})
