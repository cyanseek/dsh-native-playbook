#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function main() {
  const [snapshotText, commitText, taskMapText] = await Promise.all([
    readFile(join(root, 'generated', 'upstream.json'), 'utf8'),
    readFile(join(root, 'generated', 'UPSTREAM_COMMIT'), 'utf8'),
    readFile(join(root, 'catalog', 'task-map.yml'), 'utf8'),
  ])
  const snapshot = JSON.parse(snapshotText)
  const taskMap = parse(taskMapText)
  const commit = commitText.trim()
  const failures = []

  if (snapshot._notice !== 'DO NOT EDIT BY HAND. Run pnpm sync:upstream.') {
    failures.push('generated/upstream.json is missing the generated-file notice')
  }
  if (!/^[a-f0-9]{40}$/.test(commit) || snapshot.upstreamCommit !== commit) {
    failures.push('generated/UPSTREAM_COMMIT does not match the snapshot')
  }
  if (!snapshot.sourceRepository?.startsWith('https://github.com/deepseek-ai/deepseek-harness')) {
    failures.push('snapshot source repository is not the official DeepSeek Harness repository')
  }
  if (!taskMap || taskMap.version !== 1 || !Array.isArray(taskMap.entries)) {
    failures.push('catalog/task-map.yml is not schema version 1')
  } else {
    const ids = new Set()
    for (const entry of taskMap.entries) {
      if (ids.has(entry.id)) failures.push(`duplicate task-map id: ${entry.id}`)
      ids.add(entry.id)
      for (const recommendation of entry.recommendations ?? []) {
        if (!snapshot.tools[recommendation.capability]) {
          failures.push(`${entry.id} references missing upstream capability ${recommendation.capability}`)
        }
      }
    }
    if (taskMap.entries.length < 30) failures.push('task map has fewer than 30 mappings')
  }
  if (Object.keys(snapshot.tools ?? {}).length < 40) failures.push('snapshot has fewer than 40 tools')

  if (failures.length > 0) {
    throw new Error(`STALE_UPSTREAM_SNAPSHOT:\n- ${failures.join('\n- ')}`)
  }
  process.stdout.write(
    `Verified ${Object.keys(snapshot.tools).length} tools and ${taskMap.entries.length} task mappings at ${commit}.\n`,
  )
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
