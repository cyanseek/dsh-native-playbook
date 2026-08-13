#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import {
  explainNativeCapability,
  listNativeCapabilities,
  loadUpstreamSnapshot,
  lookupNativeCapability,
} from './api.js'
import { asNativePlaybookError, NativePlaybookError } from './errors.js'
import { installSkill } from './install.js'
import { inspectDshProfile } from './profile.js'

interface ParsedArguments {
  command?: string
  positionals: string[]
  json: boolean
  profile?: string
  target?: 'project' | 'dsh'
}

async function main(argv: string[]): Promise<void> {
  const args = parseArguments(argv)
  if (!args.command || args.command === 'help' || args.command === '--help') {
    printHelp()
    return
  }
  if (args.command === '--version' || args.command === '-V') {
    process.stdout.write('0.1.0\n')
    return
  }

  const profile = args.profile ? await inspectDshProfile({ profile: args.profile }) : undefined
  switch (args.command) {
    case 'lookup': {
      const task = args.positionals.join(' ').trim()
      const result = await lookupNativeCapability(task, { ...(profile ? { profile } : {}) })
      emit(args.json, result, formatLookup(result))
      return
    }
    case 'status': {
      if (!profile || !args.profile) {
        throw new NativePlaybookError('PROFILE_NOT_FOUND', 'status requires --profile <name>.')
      }
      const capabilities = await listNativeCapabilities(profile)
      emit(args.json, { profile: args.profile, capabilities }, formatCapabilities(capabilities))
      return
    }
    case 'list': {
      const capabilities = await listNativeCapabilities(profile)
      emit(args.json, { capabilities }, formatCapabilities(capabilities))
      return
    }
    case 'explain': {
      const name = args.positionals[0]
      if (!name) throw new NativePlaybookError('UNKNOWN_CAPABILITY', 'explain requires a capability name.')
      const capability = await explainNativeCapability(name, profile)
      emit(args.json, capability, formatCapabilities([capability]))
      return
    }
    case 'doctor': {
      const snapshot = await loadUpstreamSnapshot()
      const probe = spawnSync('dsh', ['--version'], { encoding: 'utf8' })
      const dsh = probe.error && (probe.error as NodeJS.ErrnoException).code === 'ENOENT'
        ? { available: false, code: 'DSH_NOT_FOUND' }
        : { available: probe.status === 0, version: probe.stdout.trim() || undefined }
      const result = {
        ok: true,
        snapshot: { upstreamCommit: snapshot.upstreamCommit, tools: Object.keys(snapshot.tools).length },
        dsh,
      }
      emit(args.json, result, [
        `Upstream snapshot: ${snapshot.upstreamCommit}`,
        `Native tools: ${Object.keys(snapshot.tools).length}`,
        `DSH CLI: ${dsh.available ? dsh.version ?? 'available' : 'not found (static lookup still works)'}`,
      ].join('\n'))
      return
    }
    case 'install': {
      if (!args.target) {
        throw new NativePlaybookError('SKILL_INSTALL_FAILED', 'install requires --target project|dsh.')
      }
      const result = await installSkill({ target: args.target })
      emit(args.json, result, `${result.updated ? 'Updated' : 'Installed'} Skill at ${result.path}`)
      return
    }
    default:
      throw new NativePlaybookError('NO_NATIVE_MATCH', `Unknown command: ${args.command}`)
  }
}

function parseArguments(argv: string[]): ParsedArguments {
  const result: ParsedArguments = { positionals: [], json: false }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (!value) continue
    if (
      !result.command &&
      (value === '--help' || value === '--version' || value === '-V')
    ) {
      result.command = value
    } else if (!result.command && !value.startsWith('--')) {
      result.command = value
    } else if (value === '--json') {
      result.json = true
    } else if (value === '--profile') {
      const profile = argv[index + 1]
      if (!profile) throw new NativePlaybookError('PROFILE_NOT_FOUND', '--profile requires a value.')
      result.profile = profile
      index += 1
    } else if (value === '--target') {
      const target = argv[index + 1]
      if (target !== 'project' && target !== 'dsh') {
        throw new NativePlaybookError('SKILL_INSTALL_FAILED', '--target must be project or dsh.')
      }
      result.target = target
      index += 1
    } else if (value.startsWith('--')) {
      throw new NativePlaybookError('NO_NATIVE_MATCH', `Unknown option: ${value}`)
    } else {
      result.positionals.push(value)
    }
  }
  return result
}

function formatLookup(result: Awaited<ReturnType<typeof lookupNativeCapability>>): string {
  const lines = [`Task: ${result.task}`, `Matched: ${result.mappingId}`, 'Native recommendation:']
  for (const item of result.recommendations) {
    lines.push(`  ${statusMark(item.status)} ${item.capability} [${item.status}]${item.usage ? ` — ${item.usage}` : ''}`)
    lines.push(`    ${item.reason}`)
    if (item.fallback) lines.push(`    Fallback: ${item.fallback}`)
  }
  lines.push(`External plugin needed: ${result.externalPluginNeeded ? 'yes' : 'no'}`)
  return lines.join('\n')
}

function formatCapabilities(
  capabilities: Awaited<ReturnType<typeof listNativeCapabilities>>,
): string {
  return capabilities
    .map((item) => `${statusMark(item.status)} ${item.capability.padEnd(24)} ${item.status}`)
    .join('\n')
}

function statusMark(status: string): string {
  if (status === 'ready') return '✓'
  if (status === 'platform-dependent' || status === 'requires-provider') return '◐'
  return '○'
}

function emit(json: boolean, value: unknown, text: string): void {
  process.stdout.write(json ? `${JSON.stringify(value, null, 2)}\n` : `${text}\n`)
}

function printHelp(): void {
  process.stdout.write(`dsh-native — map tasks to native DeepSeek Harness capabilities

Usage:
  dsh-native lookup "<task>" [--profile <name>] [--json]
  dsh-native status --profile <name> [--json]
  dsh-native list [--profile <name>] [--json]
  dsh-native explain <capability> [--profile <name>] [--json]
  dsh-native doctor [--json]
  dsh-native install --target project|dsh [--json]
`)
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const nativeError = asNativePlaybookError(error)
  const wantsJson = process.argv.includes('--json')
  if (wantsJson) {
    process.stdout.write(`${JSON.stringify({ error: { code: nativeError.code, message: nativeError.message } })}\n`)
  } else {
    process.stderr.write(`${nativeError.code}: ${nativeError.message}\n`)
  }
  process.exitCode = 1
})
