#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [snapshot, taskMap, recipeFiles] = await Promise.all([
  readJson(join(root, 'generated', 'upstream.json')),
  readYaml(join(root, 'catalog', 'task-map.yml')),
  readdir(join(root, 'activation-recipes')),
])
const recipes = await Promise.all(
  recipeFiles
    .filter((filename) => filename.endsWith('.yml') || filename.endsWith('.yaml'))
    .sort()
    .map((filename) => readYaml(join(root, 'activation-recipes', filename))),
)

const tools = Object.values(snapshot.tools ?? {})
const entries = Array.isArray(taskMap.entries) ? taskMap.entries : []
const recommendations = entries.flatMap((entry) => entry.recommendations ?? [])
const mappedCapabilities = new Set(recommendations.map((item) => item.capability))
for (const capability of mappedCapabilities) {
  if (!snapshot.tools?.[capability]) {
    throw new Error(`Task map references unknown official capability: ${capability}`)
  }
}

const nativeMappings = entries.filter((entry) => entry.externalPluginNeeded === false)
const providerDependent = new Set(
  recommendations
    .filter((item) => item.statusOverride === 'requires-provider')
    .map((item) => item.capability),
)
const safeRecipes = recipes.filter((recipe) => recipe.risk === 'low')
const metrics = {
  schemaVersion: 1,
  upstreamCommit: snapshot.upstreamCommit,
  nativeCoverage: {
    officialCapabilities: tools.length,
    mappedOfficialCapabilities: mappedCapabilities.size,
    readyInPinnedDefaultProfile: tools.filter((tool) => tool.defaultStatus === 'ready').length,
    platformDependentInPinnedDefaultProfile: tools.filter(
      (tool) => tool.defaultStatus === 'platform-dependent',
    ).length,
    providerDependentMappedCapabilities: providerDependent.size,
    safeActivationRecipes: safeRecipes.length,
    securityGatedAutoActivationRecipes: recipes.length - safeRecipes.length,
  },
  reinventionAvoided: {
    taskMappings: nativeMappings.length,
    intents: nativeMappings.reduce((total, entry) => total + (entry.intents?.length ?? 0), 0),
  },
}

process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`)

async function readJson(filename) {
  return JSON.parse(await readFile(filename, 'utf8'))
}

async function readYaml(filename) {
  return parse(await readFile(filename, 'utf8'))
}
