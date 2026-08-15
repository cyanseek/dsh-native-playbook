import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

test('generates impact metrics only from pinned repository facts', () => {
  const result = spawnSync(process.execPath, ['scripts/impact-metrics.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  const metrics = JSON.parse(result.stdout)
  assert.match(metrics.upstreamCommit, /^[a-f0-9]{40}$/)
  assert.ok(metrics.nativeCoverage.officialCapabilities >= 40)
  assert.ok(metrics.nativeCoverage.mappedOfficialCapabilities >= 30)
  assert.ok(metrics.nativeCoverage.readyInPinnedDefaultProfile > 0)
  assert.ok(metrics.nativeCoverage.providerDependentMappedCapabilities > 0)
  assert.equal(metrics.nativeCoverage.safeActivationRecipes, 1)
  assert.equal(metrics.nativeCoverage.securityGatedAutoActivationRecipes, 0)
  assert.ok(metrics.reinventionAvoided.taskMappings >= 30)
  assert.ok(metrics.reinventionAvoided.intents > metrics.reinventionAvoided.taskMappings)
})
