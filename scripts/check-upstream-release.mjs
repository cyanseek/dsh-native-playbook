#!/usr/bin/env node
import { readFile } from 'node:fs/promises'

const repository = 'https://api.github.com/repos/deepseek-ai/deepseek-harness'
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'dsh-native-playbook',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
}

async function get(path) {
  const response = await fetch(`${repository}/${path}`, {
    headers,
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Upstream lookup failed: HTTP ${response.status}`)
  return response.json()
}

try {
  const releases = await get('releases?per_page=20')
  const release = releases.find((item) => !item.draft && /^dsh-v\d/.test(item.tag_name))
  if (!release) throw new Error('No official DSH release found; freshness is unknown.')
  const commit = await get(`commits/${encodeURIComponent(release.tag_name)}`)
  const pinned = (await readFile(new URL('../generated/UPSTREAM_COMMIT', import.meta.url), 'utf8')).trim()
  if (!/^[a-f0-9]{40}$/.test(commit.sha ?? '')) throw new Error('Invalid upstream commit.')
  if (commit.sha !== pinned) {
    throw new Error(`New DSH release ${release.tag_name} (${commit.sha}); review and validate compatibility before syncing from ${pinned}.`)
  }
  process.stdout.write(`Pinned snapshot matches ${release.tag_name} (${pinned}).\n`)
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
