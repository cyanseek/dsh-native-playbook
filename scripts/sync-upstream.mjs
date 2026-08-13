#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = 'deepseek-ai/deepseek-harness'
const sourceRepository = `https://github.com/${repository}`
const requiredFiles = [
  'docs/tool-catalog.md',
  'docs/capability-seams.md',
  'docs/config-catalog.md',
  'packages/bundle/base/cordis.patch.yml',
  'packages/skill/skill-filesystem/README.md',
  'apps/cli/reference/README.md',
]
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function main() {
  const sourceDir = option('--source-dir')
  if (process.argv.includes('--source-dir') && !sourceDir) {
    throw codedError('UPSTREAM_PARSE_FAILED', '--source-dir requires a path.')
  }
  const check = process.argv.includes('--check')
  const upstream = sourceDir ? await readLocalSource(resolve(sourceDir)) : await fetchRemoteSource()
  const snapshot = buildSnapshot(upstream)
  const json = `${JSON.stringify(snapshot, null, 2)}\n`
  const commitText = `${snapshot.upstreamCommit}\n`
  const jsonPath = join(root, 'generated', 'upstream.json')
  const commitPath = join(root, 'generated', 'UPSTREAM_COMMIT')

  if (check) {
    const [existingJson, existingCommit] = await Promise.all([
      readFile(jsonPath, 'utf8'),
      readFile(commitPath, 'utf8'),
    ])
    if (existingJson !== json || existingCommit !== commitText) {
      throw codedError('STALE_UPSTREAM_SNAPSHOT', 'Generated upstream snapshot is stale.')
    }
    process.stdout.write(`Verified upstream snapshot ${snapshot.upstreamCommit}.\n`)
    return
  }

  await mkdir(join(root, 'generated'), { recursive: true })
  await Promise.all([
    writeFile(jsonPath, json, 'utf8'),
    writeFile(commitPath, commitText, 'utf8'),
  ])
  process.stdout.write(
    `Synced ${Object.keys(snapshot.tools).length} tools from ${snapshot.upstreamCommit}.\n`,
  )
}

async function fetchRemoteSource() {
  try {
    const commitResponse = await fetch(`https://api.github.com/repos/${repository}/commits/master`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'dsh-native-playbook' },
    })
    if (!commitResponse.ok) {
      throw codedError('UPSTREAM_FETCH_FAILED', `GitHub commit lookup returned ${commitResponse.status}.`)
    }
    const commit = await commitResponse.json()
    if (!/^[a-f0-9]{40}$/.test(commit.sha ?? '')) {
      throw codedError('UPSTREAM_PARSE_FAILED', 'GitHub returned an invalid upstream commit SHA.')
    }
    const files = {}
    await Promise.all(
      requiredFiles.map(async (path) => {
        const response = await fetch(
          `https://raw.githubusercontent.com/${repository}/${commit.sha}/${path}`,
          { headers: { 'User-Agent': 'dsh-native-playbook' } },
        )
        if (!response.ok) {
          throw codedError('UPSTREAM_FETCH_FAILED', `${path} returned ${response.status}.`)
        }
        files[path] = await response.text()
      }),
    )
    return {
      commit: commit.sha,
      generatedAt: commit.commit?.committer?.date ?? commit.commit?.author?.date,
      files,
    }
  } catch (error) {
    if (error?.code) throw error
    throw codedError('UPSTREAM_FETCH_FAILED', 'Could not fetch the official upstream source.', error)
  }
}

async function readLocalSource(sourceDir) {
  let commit
  let generatedAt
  try {
    commit = execFileSync('git', ['-C', sourceDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    generatedAt = execFileSync('git', ['-C', sourceDir, 'show', '-s', '--format=%cI', 'HEAD'], {
      encoding: 'utf8',
    }).trim()
  } catch (error) {
    throw codedError('UPSTREAM_PARSE_FAILED', `Cannot resolve Git metadata in ${sourceDir}.`, error)
  }
  try {
    const files = Object.fromEntries(
      await Promise.all(
        requiredFiles.map(async (path) => [path, await readFile(join(sourceDir, path), 'utf8')]),
      ),
    )
    return { commit, generatedAt, files }
  } catch (error) {
    throw codedError('UPSTREAM_PARSE_FAILED', `Cannot read required source files in ${sourceDir}.`, error)
  }
}

function buildSnapshot(upstream) {
  const toolCatalog = upstream.files['docs/tool-catalog.md']
  const configCatalog = upstream.files['docs/config-catalog.md']
  const baseConfig = upstream.files['packages/bundle/base/cordis.patch.yml']
  const generatedAt = new Date(upstream.generatedAt)
  if (
    !toolCatalog ||
    !configCatalog ||
    !baseConfig ||
    !/^[a-f0-9]{40}$/.test(upstream.commit) ||
    Number.isNaN(generatedAt.valueOf())
  ) {
    throw codedError('UPSTREAM_PARSE_FAILED', 'Required upstream data is incomplete.')
  }

  const requirements = {
    ...parseRequirements(configCatalog),
    ...parseToolMapRequirements(toolCatalog),
  }
  const baseRows = parseRows(baseConfig)
  const tools = parseTools(toolCatalog, requirements, baseRows, baseConfig)
  if (Object.keys(tools).length < 40 || baseRows.length < 40) {
    throw codedError('UPSTREAM_PARSE_FAILED', 'Upstream parser found too few tools or base rows.')
  }

  return {
    _notice: 'DO NOT EDIT BY HAND. Run pnpm sync:upstream.',
    schemaVersion: 1,
    sourceRepository,
    upstreamCommit: upstream.commit,
    generatedAt: generatedAt.toISOString(),
    sources: requiredFiles.map((path) => `${sourceRepository}/blob/${upstream.commit}/${path}`),
    tools,
    basePlugins: Object.fromEntries(
      baseRows
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((row) => [
          row.id,
          { id: row.id, package: row.package, disabled: row.disabled },
        ]),
    ),
  }
}

function parseToolMapRequirements(source) {
  const result = {}
  for (const line of source.split(/\r?\n/)) {
    if (!line.startsWith('| `@deepseek-ai/')) continue
    const cells = line.split('|').map((cell) => cell.trim())
    const packageName = cells[1]?.match(/^`([^`]+)`$/)?.[1]
    const requiresCell = cells[3]
    if (!packageName || !requiresCell) continue
    result[packageName] = [...requiresCell.matchAll(/ctx\.([A-Za-z0-9]+)/g)].map(
      (match) => match[1],
    )
  }
  return result
}

function parseRequirements(source) {
  const result = {}
  let currentPackage
  for (const line of source.split(/\r?\n/)) {
    const packageMatch = line.match(/^## `([^`]+)`$/)
    if (packageMatch) {
      currentPackage = packageMatch[1]
      result[currentPackage] ??= []
      continue
    }
    if (currentPackage && line.startsWith('Requires:')) {
      result[currentPackage] = [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1])
    }
  }
  return result
}

function parseTools(source, requirements, baseRows, baseConfig) {
  const entries = []
  let currentPackage
  for (const line of source.split(/\r?\n/)) {
    const packageMatch = line.match(/^## `([^`]+)`$/)
    if (packageMatch) {
      currentPackage = packageMatch[1]
      continue
    }
    const toolMatch = line.match(/^### `([^`]+)`$/)
    if (toolMatch && currentPackage) {
      entries.push({ name: toolMatch[1], package: currentPackage })
    }
  }

  for (const row of baseRows) {
    const toolName = row.raw.match(/^\s+toolName:\s*([^\s#]+)\s*$/m)?.[1]
    if (toolName && !entries.some((entry) => entry.name === toolName)) {
      entries.push({ name: unquote(toolName), package: row.package })
    }
  }

  const uniqueEntries = new Map()
  for (const entry of entries) {
    const existing = uniqueEntries.get(entry.name)
    if (!existing || packageRank(entry.package, baseRows) > packageRank(existing.package, baseRows)) {
      uniqueEntries.set(entry.name, entry)
    }
  }

  return Object.fromEntries(
    [...uniqueEntries.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => [
        entry.name,
        {
          name: entry.name,
          package: entry.package,
          requires: requirements[entry.package] ?? [],
          defaultStatus: defaultStatus(entry, baseRows, baseConfig),
        },
      ]),
  )
}

function packageRank(packageName, rows) {
  const matching = rows.filter(
    (row) => row.package === packageName || row.package.startsWith(`${packageName}/`),
  )
  if (matching.some((row) => row.disabled === false)) return 3
  if (matching.some((row) => row.disabled === 'platform-dependent')) return 2
  if (matching.length > 0) return 1
  return 0
}

function defaultStatus(tool, rows, baseConfig) {
  const matching = rows.filter(
    (row) => row.package === tool.package || row.package.startsWith(`${tool.package}/`),
  )
  if (matching.length === 0) return 'opt-in'
  if (matching.every((row) => row.disabled === true)) return 'disabled'
  if (matching.some((row) => row.disabled === 'platform-dependent')) return 'platform-dependent'
  if (tool.name === 'run_code') return 'opt-in'
  if (tool.name === 'web_fetch' && /\bfetch:\s*false\b/.test(baseConfig)) return 'disabled'
  return 'ready'
}

function parseRows(source) {
  const lines = source.split(/\r?\n/)
  const rows = []
  let current
  const flush = () => {
    if (!current) return
    const raw = current.lines.join('\n')
    const packageName = raw.match(/^\s+name:\s*['"]?([^'"\s]+)['"]?\s*$/m)?.[1]
    if (packageName) {
      const disabledValue = raw.match(/^\s+disabled:\s*(.+?)\s*$/m)?.[1]
      rows.push({
        id: current.id,
        package: packageName,
        disabled:
          disabledValue === 'true'
            ? true
            : disabledValue?.includes('process.platform')
              ? 'platform-dependent'
              : false,
        raw,
      })
    }
    current = undefined
  }

  for (const line of lines) {
    const match = line.match(/^(\s*)-\s+id:\s*([^\s#]+)\s*$/)
    if (match?.[2]) {
      flush()
      current = { id: unquote(match[2]), lines: [line] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  flush()
  return rows
}

function option(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function unquote(value) {
  return value.replace(/^['"]|['"]$/g, '')
}

function codedError(code, message, cause) {
  const error = new Error(`${code}: ${message}`, { cause })
  error.code = code
  return error
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
