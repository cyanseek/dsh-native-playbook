import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { NativePlaybookError } from './errors.js'
import { loadUpstreamSnapshot } from './catalog.js'
import type {
  CapabilityStatus,
  ProfileInspection,
  ProfileRow,
  UpstreamSnapshot,
  UpstreamTool,
} from './types.js'

const execFileAsync = promisify(execFile)

export interface InspectProfileOptions {
  profile: string
  dshCommand?: string
  cwd?: string
}

export async function inspectDshProfile(options: InspectProfileOptions): Promise<ProfileInspection> {
  const snapshot = await loadUpstreamSnapshot()
  const dshCommand = options.dshCommand ?? 'dsh'
  if (!/^[A-Za-z0-9._-]+$/.test(options.profile)) {
    throw new NativePlaybookError(
      'PROFILE_NOT_FOUND',
      `Invalid DSH profile name: ${options.profile}`,
    )
  }
  try {
    const { stdout } = await execFileAsync(
      dshCommand,
      ['--profile', options.profile, '--dump-config'],
      {
        cwd: options.cwd,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        shell: process.platform === 'win32',
      },
    )
    return parseProfileConfig(options.profile, stdout, snapshot)
  } catch (error) {
    const systemError = error as NodeJS.ErrnoException & { stderr?: string }
    if (systemError.code === 'ENOENT') {
      throw new NativePlaybookError('DSH_NOT_FOUND', `Cannot find the DSH executable: ${dshCommand}.`, {
        cause: error,
      })
    }
    if (/profile.+(not found|missing|does not exist)/i.test(systemError.stderr ?? systemError.message)) {
      throw new NativePlaybookError('PROFILE_NOT_FOUND', `DSH profile '${options.profile}' was not found.`, {
        cause: error,
      })
    }
    throw new NativePlaybookError(
      'PROFILE_INSPECTION_FAILED',
      `Could not inspect DSH profile '${options.profile}'.`,
      { cause: error },
    )
  }
}

export function parseProfileConfig(
  profile: string,
  source: string,
  snapshot: UpstreamSnapshot,
): ProfileInspection {
  const rows = parseRows(source)
  const capabilityStatuses = Object.fromEntries(
    Object.values(snapshot.tools)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((tool) => [tool.name, resolveProfileStatus(tool, rows)]),
  )
  return { profile, rows, capabilityStatuses }
}

export function parseRows(source: string): ProfileRow[] {
  const lines = source.split(/\r?\n/)
  const rows: ProfileRow[] = []
  let current: { id: string; indent: number; lines: string[] } | undefined

  const flush = (): void => {
    if (!current) return
    const raw = current.lines.join('\n')
    const packageMatch = raw.match(/^\s+name:\s*['"]?([^'"\s]+)['"]?\s*$/m)
    if (packageMatch?.[1]) {
      let disabled: boolean | 'platform-dependent' = false
      const disabledMatch = raw.match(/^\s+disabled:\s*(.+?)\s*$/m)
      if (disabledMatch?.[1] === 'true') disabled = true
      else if (disabledMatch?.[1]?.includes('process.platform')) disabled = 'platform-dependent'
      rows.push({ id: current.id, package: packageMatch[1], disabled, raw })
    }
    current = undefined
  }

  for (const line of lines) {
    const match = line.match(/^(\s*)-\s+id:\s*([^\s#]+)\s*$/)
    if (match?.[1] !== undefined && match[2]) {
      flush()
      current = { id: unquote(match[2]), indent: match[1].length, lines: [line] }
      continue
    }
    if (current) current.lines.push(line)
  }
  flush()
  return rows
}

function resolveProfileStatus(tool: UpstreamTool, rows: ProfileRow[]): CapabilityStatus {
  const matching = rows.filter(
    (row) => row.package === tool.package || row.package.startsWith(`${tool.package}/`),
  )
  if (matching.length === 0) return 'opt-in'
  if (matching.every((row) => row.disabled === true)) return 'disabled'
  if (matching.some((row) => row.disabled === 'platform-dependent')) return 'platform-dependent'

  if (tool.name === 'run_code') {
    return matching.some((row) => /^\s+mode:\s*(?:code|both)\s*$/m.test(row.raw)) ? 'ready' : 'opt-in'
  }
  if (tool.name === 'web_fetch') {
    return matching.some((row) => /^\s+fetch:\s*true\s*$/m.test(row.raw)) ? 'ready' : 'disabled'
  }
  if (tool.name === 'lsp') {
    return rows.some((row) => /\/dsh-lsp-(?!tool)/.test(row.package)) ? 'ready' : 'requires-provider'
  }
  if (tool.name.startsWith('terminal_')) {
    return rows.some((row) => /\/dsh-terminal-(?!tool)/.test(row.package))
      ? 'ready'
      : 'requires-provider'
  }
  if (tool.name === 'web_search') {
    return rows.some((row) => /\/dsh-web-search-/.test(row.package)) ? 'ready' : 'requires-provider'
  }
  return 'ready'
}

function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/g, '')
}
