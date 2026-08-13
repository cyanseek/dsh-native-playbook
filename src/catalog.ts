import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { NativePlaybookError } from './errors.js'
import type { TaskMap, TaskMapEntry, UpstreamSnapshot } from './types.js'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))

export function resolvePackageFile(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, new URL('../', import.meta.url)))
}

export async function loadTaskMap(): Promise<TaskMap> {
  const path = resolvePackageFile('catalog/task-map.yml')
  let value: unknown
  try {
    value = parse(await readFile(path, 'utf8'))
  } catch (error) {
    throw new NativePlaybookError('INVALID_TASK_MAP', `Cannot load task map at ${path}.`, {
      cause: error,
    })
  }

  if (!isTaskMap(value)) {
    throw new NativePlaybookError('INVALID_TASK_MAP', 'catalog/task-map.yml does not match schema version 1.')
  }
  return value
}

export async function loadUpstreamSnapshot(): Promise<UpstreamSnapshot> {
  const path = resolvePackageFile('generated/upstream.json')
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as Partial<UpstreamSnapshot>
    if (
      value.schemaVersion !== 1 ||
      typeof value.upstreamCommit !== 'string' ||
      !/^[a-f0-9]{40}$/.test(value.upstreamCommit) ||
      !value.tools ||
      !value.basePlugins
    ) {
      throw new Error('invalid snapshot shape')
    }
    return value as UpstreamSnapshot
  } catch (error) {
    throw new NativePlaybookError('STALE_UPSTREAM_SNAPSHOT', `Cannot load upstream snapshot at ${path}.`, {
      cause: error,
    })
  }
}

export function getPackageRoot(): string {
  return packageRoot
}

function isTaskMap(value: unknown): value is TaskMap {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { version?: unknown; entries?: unknown }
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.entries) &&
    candidate.entries.length > 0 &&
    candidate.entries.every(isTaskMapEntry)
  )
}

function isTaskMapEntry(value: unknown): value is TaskMapEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<TaskMapEntry>
  return (
    typeof entry.id === 'string' &&
    typeof entry.category === 'string' &&
    Array.isArray(entry.intents) &&
    entry.intents.length > 0 &&
    entry.intents.every((intent) => typeof intent === 'string') &&
    Array.isArray(entry.recommendations) &&
    entry.recommendations.length > 0 &&
    entry.recommendations.every(
      (item) =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as { capability?: unknown }).capability === 'string' &&
        typeof (item as { reason?: unknown }).reason === 'string',
    ) &&
    typeof entry.externalPluginNeeded === 'boolean'
  )
}
