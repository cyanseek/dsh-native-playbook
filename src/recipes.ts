import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { NativePlaybookError } from './errors.js'
import type { ActivationRecipe } from './types.js'

const RECIPE_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'activation-recipes')
const RECIPE_FILES = ['session-search.yml'] as const
const ALLOWED_CAPABILITIES = new Set(['session_search', 'session_event_search'])

export async function listActivationRecipes(): Promise<ActivationRecipe[]> {
  return Promise.all(RECIPE_FILES.map(async (filename) => loadRecipe(join(RECIPE_DIRECTORY, filename))))
}

export async function findActivationRecipe(capability: string): Promise<ActivationRecipe | undefined> {
  const recipes = await listActivationRecipes()
  return recipes.find(
    (recipe) => recipe.capability === capability || recipe.provides.includes(capability),
  )
}

async function loadRecipe(filename: string): Promise<ActivationRecipe> {
  let candidate: unknown
  try {
    candidate = parse(await readFile(filename, 'utf8'))
  } catch (error) {
    throw new NativePlaybookError('INVALID_RECIPE', `Could not load activation recipe ${filename}.`, {
      cause: error,
    })
  }
  return validateRecipe(candidate, filename)
}

function validateRecipe(candidate: unknown, filename: string): ActivationRecipe {
  if (!isRecord(candidate)) invalid(filename, 'recipe must be an object')
  const recipe = candidate as Record<string, unknown>
  if (recipe.schemaVersion !== 1) invalid(filename, 'schemaVersion must be 1')
  if (typeof recipe.id !== 'string' || !/^[a-z0-9-]+$/.test(recipe.id)) invalid(filename, 'id is invalid')
  if (typeof recipe.capability !== 'string' || !ALLOWED_CAPABILITIES.has(recipe.capability)) {
    invalid(filename, 'capability is not allowlisted')
  }
  if (!isStringArray(recipe.provides) || recipe.provides.some((item) => !ALLOWED_CAPABILITIES.has(item))) {
    invalid(filename, 'provides contains a non-allowlisted capability')
  }
  if (typeof recipe.description !== 'string' || recipe.description.length < 10) invalid(filename, 'description is missing')
  if (!isStringArray(recipe.upstreamEvidence) || recipe.upstreamEvidence.length === 0) invalid(filename, 'upstream evidence is missing')
  if (recipe.upstreamEvidence.some((url) => !/^https:\/\/github\.com\/deepseek-ai\/deepseek-harness\/blob\/[a-f0-9]{40}\//.test(url))) {
    invalid(filename, 'upstream evidence must pin official DSH source URLs')
  }
  if (!isStringArray(recipe.compatibleDshVersions) || recipe.compatibleDshVersions.length === 0) invalid(filename, 'compatible versions are missing')
  if (recipe.compatibleDshVersions.some((version) => !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))) {
    invalid(filename, 'compatible versions must be exact semantic versions')
  }
  if (!isStringArray(recipe.preconditions) || recipe.preconditions.length === 0) invalid(filename, 'preconditions are missing')
  if (recipe.risk !== 'low') invalid(filename, 'only low-risk recipes are allowed')
  if (!['immediate', 'next-turn', 'new-session', 'restart'].includes(String(recipe.activationEffect))) {
    invalid(filename, 'activationEffect is invalid')
  }
  if (!Array.isArray(recipe.patches) || recipe.patches.length !== 2) invalid(filename, 'patch list is incomplete')
  if (!isStringArray(recipe.verification) || recipe.verification.length === 0) invalid(filename, 'verification is missing')
  if (recipe.rollback !== 'restore-snapshot') invalid(filename, 'rollback must restore a snapshot')

  const serialized = JSON.stringify(recipe.patches)
  const expected = JSON.stringify([
    { id: 'session-query-sqlite', config: { path: ':memory:', openAt: 'first-search' } },
    { insert: [{ id: 'tool-session-query', name: 'dsh-native-playbook/session-query' }] },
  ])
  if (serialized !== expected) invalid(filename, 'patches do not match the reviewed allowlist')
  return candidate as unknown as ActivationRecipe
}

function invalid(filename: string, reason: string): never {
  throw new NativePlaybookError('INVALID_RECIPE', `Invalid activation recipe ${filename}: ${reason}.`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0)
}
