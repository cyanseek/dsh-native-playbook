import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import type { NativeCapabilityToolResult } from '../src/plugin.js'
import { apply } from '../src/plugin.js'
import { parse } from 'yaml'

test('registers a DSH tool backed by the shared resolver', async () => {
  let definition: Parameters<Parameters<typeof apply>[0]['tools']['register']>[0] | undefined
  let prompt: { name: string; order: number; text: string } | undefined
  const context: Parameters<typeof apply>[0] = {
    tools: {
      register(candidate) {
        definition = candidate
      },
      schemas() {
        return [{ name: 'bash' }, { name: 'native_capability' }]
      },
    },
    systemPrompt: {
      section(candidate) {
        prompt = candidate
      },
    },
  }
  apply(context)

  assert.ok(definition)
  assert.equal(prompt?.name, 'tool:native-capability')
  assert.match(prompt?.text ?? '', /Prefer operational official DSH capabilities/)
  assert.equal(definition.name, 'native_capability')
  assert.deepEqual(definition.output.schema.required, [
    'native',
    'task',
    'capability',
    'recommendations',
    'status',
    'lifecycle',
    'action',
    'actionReason',
    'verified',
    'fallback',
  ])
  assert.ok(!JSON.stringify(definition.output.schema).includes('"required":true'))
  const value: NativeCapabilityToolResult = await definition.execute(
    { task: 'run tests in background' },
    {},
  )
  assert.equal(value.native, true)
  assert.equal(value.recommendations[0]?.capability, 'bash')
  assert.equal(value.recommendations[0]?.status, 'ready')
  assert.equal(value.recommendations[0]?.lifecycle.operational, true)
  assert.equal(value.recommendations[1]?.status, 'ready')
  assert.equal(value.recommendations[1]?.lifecycle.visible, false)
  assert.equal(value.status, 'ready')
  assert.equal(value.action, 'use')
  assert.match(value.actionReason, /active runtime/i)
  assert.equal(value.verified, true)
  assert.equal(definition.isConcurrencySafe(), false)
})

test('declares an installable DSH bundle that mounts the plugin export', async () => {
  const [manifestText, patchText] = await Promise.all([
    readFile(join(process.cwd(), 'package.json'), 'utf8'),
    readFile(join(process.cwd(), 'cordis.patch.yml'), 'utf8'),
  ])
  const manifest = JSON.parse(manifestText)
  const patch = parse(patchText)
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(manifest.exports['./plugin'].import, './dist/plugin.js')
  assert.equal(manifest.exports['./session-query'].import, './dist/session-query.js')
  assert.deepEqual(patch, [{ insert: [{ id: 'native-playbook', name: 'dsh-native-playbook/plugin' }] }])
})

test('does not infer provider readiness from provider-backed tool visibility alone', async () => {
  let definition: Parameters<Parameters<typeof apply>[0]['tools']['register']>[0] | undefined
  const context: Parameters<typeof apply>[0] = {
    tools: {
      register(candidate) {
        definition = candidate
      },
      schemas() {
        return [
          { name: 'lsp' },
          { name: 'terminal_open' },
          { name: 'terminal_read' },
          { name: 'native_capability' },
        ]
      },
    },
    systemPrompt: { section() {} },
  }
  apply(context)
  assert.ok(definition)
  const value = await definition.execute({ task: 'find all symbol references' }, {})
  assert.equal(value.capability, 'lsp')
  assert.equal(value.status, 'requires-provider')
  assert.equal(value.lifecycle.visible, true)
  assert.equal(value.lifecycle.providerReady, 'unknown')
  assert.equal(value.lifecycle.operational, 'unknown')
  assert.equal(value.action, 'fallback')
  assert.match(value.fallback, /grep/i)

  const terminal = await definition.execute({ task: 'open persistent terminal' }, {})
  assert.equal(terminal.capability, 'terminal_open')
  assert.equal(terminal.status, 'requires-provider')
  assert.equal(terminal.lifecycle.providerReady, 'unknown')
  assert.equal(terminal.lifecycle.operational, 'unknown')
  assert.equal(terminal.action, 'fallback')
})
