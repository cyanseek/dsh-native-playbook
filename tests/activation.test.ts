import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  activateNativeCapability,
  deactivateNativeCapability,
  NativePlaybookError,
  planNativeActivation,
} from '../src/api.js'

const baseline = `
- insert:
    - id: session-query-sqlite
      name: '@deepseek-ai/dsh-session-query-sqlite'
      config:
        path: ':memory:'
        openAt: never
`

function composed(active: boolean): string {
  return active
    ? `
- insert:
    - id: session-query-sqlite
      name: '@deepseek-ai/dsh-session-query-sqlite'
      config:
        path: ':memory:'
        openAt: first-search
    - id: tool-session-query
      name: 'dsh-native-playbook/session-query'
`
    : baseline
}

async function fixture() {
  const dshHome = await mkdtemp(join(tmpdir(), 'dsh-native-activation-'))
  const profileDir = join(dshHome, 'profiles', 'web')
  const patch = join(profileDir, 'cordis.patch.yml')
  await mkdir(profileDir, { recursive: true })
  const original = '# user-owned profile layer\n[]\n'
  await writeFile(patch, original, 'utf8')
  const runDsh = async (): Promise<string> => {
    const current = await readFile(patch, 'utf8')
    return composed(current.includes('tool-session-query'))
  }
  return { dshHome, patch, original, runDsh }
}

test('plans, activates, verifies, and exactly restores the reviewed recipe', async () => {
  const value = await fixture()
  const options = {
    profile: 'web',
    dshHome: value.dshHome,
    version: '0.1.0-rc.6',
    runDsh: value.runDsh,
  }
  const plan = await planNativeActivation('session_search', options)
  assert.equal(plan.allowed, true)
  assert.equal(plan.activationEffect, 'restart')

  const activated = await activateNativeCapability('session_search', options)
  assert.equal(activated.action, 'activated')
  assert.equal(activated.verified, true)
  assert.equal(activated.lifecycle?.providerReady, true)
  assert.equal(activated.lifecycle?.activationEffect, 'restart')
  assert.match(await readFile(value.patch, 'utf8'), /openAt: first-search/)
  assert.match(await readFile(value.patch, 'utf8'), /dsh-native-playbook\/session-query/)

  const deactivated = await deactivateNativeCapability('session_search', options)
  assert.equal(deactivated.action, 'deactivated')
  assert.equal(deactivated.verified, true)
  assert.equal(await readFile(value.patch, 'utf8'), value.original)
  await assert.rejects(
    access(join(value.dshHome, 'native-playbook', 'activation-snapshots', 'web', 'session-search.json')),
  )
})

test('withholds activation outside the recipe compatibility gate', async () => {
  const value = await fixture()
  const result = await activateNativeCapability('session_search', {
    profile: 'web',
    dshHome: value.dshHome,
    version: '0.1.0-rc.5',
    runDsh: value.runDsh,
  })
  assert.equal(result.action, 'withheld')
  assert.equal(result.changed, false)
  assert.equal(await readFile(value.patch, 'utf8'), value.original)
})

test('rolls back byte-for-byte when post-write verification fails', async () => {
  const value = await fixture()
  await assert.rejects(
    activateNativeCapability('session_search', {
      profile: 'web',
      dshHome: value.dshHome,
      version: '0.1.0-rc.6',
      runDsh: async () => baseline,
    }),
    (error: unknown) => error instanceof NativePlaybookError && error.code === 'ACTIVATION_FAILED',
  )
  assert.equal(await readFile(value.patch, 'utf8'), value.original)
})

test('preserves a user-owned provider override instead of guessing', async () => {
  const value = await fixture()
  await writeFile(
    value.patch,
    '- id: session-query-sqlite\n  config:\n    path: custom.sqlite\n    openAt: never\n',
    'utf8',
  )
  await assert.rejects(
    activateNativeCapability('session_search', {
      profile: 'web',
      dshHome: value.dshHome,
      version: '0.1.0-rc.6',
      runDsh: async () => baseline,
    }),
    (error: unknown) => error instanceof NativePlaybookError && error.code === 'ACTIVATION_CONFLICT',
  )
  assert.match(await readFile(value.patch, 'utf8'), /custom\.sqlite/)
})

test('refuses to deactivate over edits made after activation', async () => {
  const value = await fixture()
  const options = {
    profile: 'web',
    dshHome: value.dshHome,
    version: '0.1.0-rc.6',
    runDsh: value.runDsh,
  }
  await activateNativeCapability('session_search', options)
  const changed = `${await readFile(value.patch, 'utf8')}# later user edit\n`
  await writeFile(value.patch, changed, 'utf8')
  await assert.rejects(
    deactivateNativeCapability('session_search', options),
    (error: unknown) => error instanceof NativePlaybookError && error.code === 'ACTIVATION_CONFLICT',
  )
  assert.equal(await readFile(value.patch, 'utf8'), changed)
})
