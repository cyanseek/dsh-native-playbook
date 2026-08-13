import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import type { NativeCapabilityToolResult } from '../src/plugin.js'
import { apply } from '../src/plugin.js'
import { parse } from 'yaml'

test('registers a DSH tool backed by the shared resolver', async () => {
  let definition: Parameters<Parameters<typeof apply>[0]['tools']['register']>[0] | undefined
  const context: Parameters<typeof apply>[0] = {
    tools: {
      register(candidate) {
        definition = candidate
      },
      schemas() {
        return [{ name: 'bash' }, { name: 'native_capability' }]
      },
    },
  }
  apply(context)

  assert.ok(definition)
  assert.equal(definition.name, 'native_capability')
  assert.deepEqual(definition.output.schema.required, ['native', 'recommendations', 'status'])
  assert.ok(!JSON.stringify(definition.output.schema).includes('"required":true'))
  const value: NativeCapabilityToolResult = await definition.execute(
    { task: 'run tests in background' },
    {},
  )
  assert.equal(value.native, true)
  assert.equal(value.recommendations[0]?.capability, 'bash')
  assert.equal(value.recommendations[0]?.status, 'ready')
  assert.equal(value.recommendations[1]?.status, 'opt-in')
  assert.equal(value.status, 'ready')
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
  assert.deepEqual(patch, [{ insert: [{ id: 'native-playbook', name: 'dsh-native-playbook/plugin' }] }])
})
