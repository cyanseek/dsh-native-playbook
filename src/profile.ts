import { NativePlaybookError } from './errors.js'
import { loadUpstreamSnapshot } from './catalog.js'
import { execDsh } from './dsh-process.js'
import type {
  CapabilityLifecycle,
  CapabilityStatus,
  ProfileInspection,
  ProfileRow,
  UpstreamSnapshot,
  UpstreamTool,
} from './types.js'

export interface InspectProfileOptions {
  profile: string
  dshCommand?: string
  cwd?: string
  visibleCapabilities?: Iterable<string>
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
    const { stdout } = await execDsh(
      dshCommand,
      ['--profile', options.profile, '--dump-config'],
      {
        cwd: options.cwd,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      },
    )
    return parseProfileConfig(options.profile, stdout, snapshot, options.visibleCapabilities)
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
  visibleCapabilities?: Iterable<string>,
): ProfileInspection {
  const rows = parseRows(source)
  const visible = visibleCapabilities ? new Set(visibleCapabilities) : undefined
  const capabilityLifecycles = Object.fromEntries(
    Object.values(snapshot.tools)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((tool) => [tool.name, resolveCapabilityLifecycle(tool, rows, visible)]),
  )
  const capabilityStatuses = Object.fromEntries(
    Object.entries(capabilityLifecycles).map(([capability, lifecycle]) => [capability, lifecycle.status]),
  )
  return { profile, rows, capabilityStatuses, capabilityLifecycles }
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

export function resolveCapabilityLifecycle(
  tool: UpstreamTool,
  rows: ProfileRow[],
  visibleCapabilities?: ReadonlySet<string>,
): CapabilityLifecycle {
  const matching = rows.filter(
    (row) => row.package === tool.package
      || row.package.startsWith(`${tool.package}/`)
      || (tool.package === '@deepseek-ai/dsh-tool-session-query'
        && row.package === 'dsh-native-playbook/session-query'),
  )
  const visible = visibleCapabilities ? visibleCapabilities.has(tool.name) : 'unknown'
  if (matching.length === 0) {
    return lifecycle('opt-in', false, visible, 'unknown', false, 'Shipped by DSH but not mounted in this profile.')
  }
  if (matching.every((row) => row.disabled === true)) {
    return lifecycle('disabled', true, visible, false, false, 'Mounted but disabled by the effective profile.')
  }
  if (matching.some((row) => row.disabled === 'platform-dependent')) {
    return lifecycle(
      'platform-dependent',
      true,
      visible,
      'unknown',
      visible === true ? true : 'unknown',
      'Mounted conditionally; operational readiness depends on the current platform.',
    )
  }

  if (tool.name === 'run_code') {
    return matching.some((row) => /^\s+mode:\s*(?:code|both)\s*$/m.test(row.raw))
      ? readyLifecycle(visible)
      : lifecycle('opt-in', true, visible, true, false, 'The tools plugin is mounted without Code Mode enabled.')
  }
  if (tool.name === 'web_fetch') {
    return matching.some((row) => /^\s+fetch:\s*true\s*$/m.test(row.raw))
      ? readyLifecycle(visible)
      : lifecycle('disabled', true, visible, false, false, 'Web fetch is disabled by the effective tool configuration.')
  }
  if (tool.name === 'lsp') {
    return providerLifecycle(
      visible,
      rows.some((row) => /\/dsh-lsp-(?!tool)/.test(row.package) && row.disabled !== true),
      'No operational LSP provider is mounted; use grep or glob as the native fallback.',
    )
  }
  if (tool.name.startsWith('terminal_')) {
    return providerLifecycle(
      visible,
      rows.some((row) => /\/dsh-terminal-(?!tool)/.test(row.package) && row.disabled !== true),
      'The terminal tool requires a mounted terminal provider.',
    )
  }
  if (tool.name === 'web_search') {
    return providerLifecycle(
      visible,
      rows.some((row) => /\/dsh-web-search-/.test(row.package) && row.disabled !== true),
      'The web-search tool requires a mounted search provider.',
    )
  }
  if (tool.package === '@deepseek-ai/dsh-tool-session-query') {
    const isSearch = tool.name === 'session_search' || tool.name === 'session_event_search'
    const queryProvider = rows.find((row) => row.package === '@deepseek-ai/dsh-session-query-sqlite')
    const providerReady = queryProvider
      ? !isSearch || /^\s+openAt:\s*(?:startup|first-search)\s*$/m.test(queryProvider.raw)
      : false
    return providerLifecycle(
      visible,
      providerReady,
      isSearch
        ? 'Session search is mounted, but full-text search is disabled in the query provider.'
        : 'The session-query tool requires a mounted session-query provider.',
    )
  }
  return readyLifecycle(visible)
}

export function lifecycleFromDefault(tool: UpstreamTool): CapabilityLifecycle {
  switch (tool.defaultStatus) {
    case 'ready':
      return readyLifecycle('unknown')
    case 'platform-dependent':
      return lifecycle('platform-dependent', true, 'unknown', 'unknown', 'unknown', 'Shipped conditionally by the default profile.')
    case 'requires-provider':
      return lifecycle('requires-provider', true, 'unknown', false, false, 'A provider is required before this capability can operate.')
    case 'disabled':
      return lifecycle('disabled', true, 'unknown', false, false, 'Shipped but disabled by default.')
    case 'unsupported':
      return lifecycle('unsupported', false, 'unknown', false, false, 'This capability is not supported by the active DSH version.')
    case 'opt-in':
      return lifecycle('opt-in', false, 'unknown', 'unknown', false, 'Shipped by DSH but not mounted by default.')
  }
}

function readyLifecycle(visible: boolean | 'unknown'): CapabilityLifecycle {
  return lifecycle(
    'ready',
    true,
    visible,
    true,
    visible === true ? true : visible === false ? false : 'unknown',
    visible === false
      ? 'Configuration is ready, but the capability is not visible to the calling Agent.'
      : 'The effective profile and provider prerequisites are ready.',
  )
}

function providerLifecycle(
  visible: boolean | 'unknown',
  providerReady: boolean,
  missingReason: string,
): CapabilityLifecycle {
  return providerReady
    ? readyLifecycle(visible)
    : lifecycle('requires-provider', true, visible, false, false, missingReason)
}

function lifecycle(
  status: CapabilityStatus,
  mounted: boolean | 'unknown',
  visible: boolean | 'unknown',
  providerReady: boolean | 'unknown',
  operational: boolean | 'unknown',
  reason: string,
): CapabilityLifecycle {
  return { shipped: true, mounted, visible, providerReady, operational, status, reason }
}

function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/g, '')
}
