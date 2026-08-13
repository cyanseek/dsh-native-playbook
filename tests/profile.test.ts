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
})

test('rejects unsafe profile names before executing DSH', async () => {
  await assert.rejects(
    inspectDshProfile({ profile: 'web;echo unsafe', dshCommand: 'missing-dsh' }),
    (error: unknown) =>
      error instanceof NativePlaybookError && error.code === 'PROFILE_NOT_FOUND',
  )
})
