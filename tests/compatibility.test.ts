import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateDshCompatibility, resolveActiveDshProfile } from '../src/api.js'

test('allows only explicitly tested DSH versions to activate', () => {
  const supported = evaluateDshCompatibility('dsh 0.1.0-rc.6\n')
  assert.equal(supported.state, 'supported')
  assert.equal(supported.activationAllowed, true)

  const unsupported = evaluateDshCompatibility('0.2.0')
  assert.equal(unsupported.state, 'unsupported')
  assert.equal(unsupported.activationAllowed, false)

  const unknown = evaluateDshCompatibility('development build')
  assert.equal(unknown.state, 'unknown')
  assert.equal(unknown.activationAllowed, false)
})

test('resolves only unambiguous active DSH profiles from launcher arguments', () => {
  assert.equal(resolveActiveDshProfile(['--profile', 'web', '--resume', 'abc']), 'web')
  assert.equal(resolveActiveDshProfile(['web', '--help']), 'web')
  assert.equal(resolveActiveDshProfile(['--profile', 'web;unsafe']), undefined)
  assert.equal(resolveActiveDshProfile(['headless', 'task']), undefined)
})
