import { activateNativeCapability, resolveActiveDshProfile } from './activation.js'
import { NativePlaybookError } from './errors.js'
import { listNativeCapabilities, lookupNativeCapability } from './lookup.js'
import { inspectDshProfile } from './profile.js'
import type {
  CapabilityLifecycle,
  CapabilityStatus,
  NativeRecommendation,
  ProfileInspection,
} from './types.js'

export const name = 'dsh-native-playbook'
export const inject = ['tools', 'systemPrompt']

const SYSTEM_PROMPT =
  'Prefer operational official DSH capabilities before an external plugin or infrastructure workaround. '
  + 'Use native_capability when readiness or activation is uncertain.'

export interface NativeCapabilityToolResult {
  native: boolean
  task: string
  capability: string
  recommendations: NativeRecommendation[]
  status: CapabilityStatus
  lifecycle: CapabilityLifecycle
  action: 'use' | 'activated' | 'fallback' | 'withheld'
  actionReason: string
  verified: boolean
  fallback: string
}

interface RuntimeToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  output: {
    schema: Record<string, unknown>
    render(args: unknown, value: unknown): Array<{ type: 'text'; text: string }>
  }
  execute(
    args: { task: string },
    exec: { agent?: unknown },
  ): Promise<NativeCapabilityToolResult>
  isConcurrencySafe(): boolean
  presentCall(args: { task: string }): {
    card: 'generic'
    title: string
    kind: 'search'
    rawInput: string
  }
}

interface RuntimeContext {
  tools: {
    register(definition: RuntimeToolDefinition): unknown
    schemas(scope?: unknown): Array<{ name: string }>
  }
  systemPrompt: {
    section(section: { name: string; order: number; text: string }): unknown
  }
}

export function apply(ctx: RuntimeContext): void {
  ctx.systemPrompt.section({
    name: 'tool:native-capability',
    order: 112,
    text: SYSTEM_PROMPT,
  })
  ctx.tools.register({
    name: 'native_capability',
    description: 'Resolve a task to operational native DeepSeek Harness capabilities and safely activate a reviewed official path when possible.',
    parameters: {
      task: {
        type: 'string',
        required: true,
        description: 'The task or intent to match against native DSH capabilities.',
      },
    },
    output: {
      schema: toolOutputSchema(),
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) ?? 'null' }],
    },
    async execute(args, exec) {
      const profileName = resolveActiveDshProfile(process.argv.slice(2))
      const visible = new Set(ctx.tools.schemas(exec.agent).map((schema) => schema.name))
      const profile = await inspectRuntimeProfile(profileName, visible)
      const result = await lookupNativeCapability(args.task, { profile })
      let primary = result.recommendations[0]
      if (!primary) {
        throw new NativePlaybookError(
          'INVALID_TASK_MAP',
          `Mapping '${result.mappingId}' has no native recommendations.`,
        )
      }

      let action: NativeCapabilityToolResult['action'] = primary.lifecycle.operational === true
        ? 'use'
        : 'fallback'
      let actionReason = primary.lifecycle.reason
      let verified = primary.lifecycle.operational === true
      if (
        profileName
        && (primary.capability === 'session_search' || primary.capability === 'session_event_search')
        && primary.lifecycle.operational !== true
      ) {
        try {
          const activation = await activateNativeCapability(primary.capability, { profile: profileName })
          if (activation.action === 'activated' || activation.action === 'already-active') {
            action = activation.action === 'activated' ? 'activated' : 'use'
            actionReason = activation.action === 'activated'
              ? `Activation was verified and takes effect after a DSH ${activation.activationEffect ?? 'restart'}.`
              : 'The reviewed native capability is already active.'
            verified = activation.verified
            if (activation.lifecycle) {
              primary = { ...primary, status: activation.lifecycle.status, lifecycle: activation.lifecycle }
              result.recommendations[0] = primary
            }
          } else {
            action = 'withheld'
            actionReason = activation.reason
          }
        } catch {
          action = 'withheld'
          actionReason = 'Activation could not be completed safely; no profile change was kept.'
        }
      }

      return {
        native: !result.externalPluginNeeded,
        task: args.task,
        capability: primary.capability,
        recommendations: result.recommendations,
        status: primary.status,
        lifecycle: primary.lifecycle,
        action,
        actionReason,
        verified,
        fallback: primary.fallback ?? fallbackFor(primary.capability),
      }
    },
    isConcurrencySafe: () => false,
    presentCall: (args) => ({
      card: 'generic',
      title: 'Check native DSH capability',
      kind: 'search',
      rawInput: args.task,
    }),
  })
}

async function inspectRuntimeProfile(
  profileName: string | undefined,
  visible: ReadonlySet<string>,
): Promise<ProfileInspection> {
  if (profileName) {
    try {
      return await inspectDshProfile({ profile: profileName, visibleCapabilities: visible })
    } catch {
      // Runtime visibility is still useful when a nested DSH inspection is unavailable.
    }
  }
  const capabilities = await listNativeCapabilities()
  const capabilityLifecycles = Object.fromEntries(
    capabilities.map((capability) => {
      const isVisible = visible.has(capability.capability)
      const lifecycle = runtimeVisibilityLifecycle(capability, isVisible)
      return [capability.capability, lifecycle]
    }),
  )
  return {
    profile: profileName ?? 'active-runtime',
    rows: [],
    capabilityLifecycles,
    capabilityStatuses: Object.fromEntries(
      Object.entries(capabilityLifecycles).map(([capability, lifecycle]) => [capability, lifecycle.status]),
    ),
  }
}

function runtimeVisibilityLifecycle(
  capability: Awaited<ReturnType<typeof listNativeCapabilities>>[number],
  visible: boolean,
): CapabilityLifecycle {
  if (!visible) return { ...capability.lifecycle, visible: false, operational: false }
  const providerEvidenceRequired = capability.requires.some((service) =>
    ['lsp', 'terminals', 'sessionQuery', 'web'].includes(service),
  )
  if (providerEvidenceRequired) {
    return {
      ...capability.lifecycle,
      mounted: true,
      visible: true,
      providerReady: 'unknown',
      operational: 'unknown',
      status: 'requires-provider',
      reason: 'The tool is visible, but provider readiness could not be verified from the active profile.',
    }
  }
  return {
    ...capability.lifecycle,
    mounted: true,
    visible: true,
    providerReady: true,
    operational: true,
    status: 'ready',
    reason: 'The capability is visible to the calling Agent in the active runtime.',
  }
}

function fallbackFor(capability: string): string {
  if (capability === 'lsp') return 'Use native grep and glob until an LSP provider is operational.'
  if (capability === 'session_search' || capability === 'session_event_search') {
    return 'Continue without full-text history search; do not inspect private session storage directly.'
  }
  return 'Use the next operational native recommendation returned for this task.'
}

function toolOutputSchema(): Record<string, unknown> {
  const triState = {
    oneOf: [
      { type: 'boolean' },
      { type: 'string', enum: ['unknown'] },
    ],
  }
  const lifecycle = {
    type: 'object',
    additionalProperties: false,
    required: ['shipped', 'mounted', 'visible', 'providerReady', 'operational', 'status', 'reason'],
    properties: {
      shipped: { type: 'boolean' },
      mounted: triState,
      visible: triState,
      providerReady: triState,
      operational: triState,
      status: statusSchema(),
      activationEffect: { type: 'string', enum: ['immediate', 'next-turn', 'new-session', 'restart'] },
      reason: { type: 'string' },
    },
  }
  return {
    type: 'object',
    additionalProperties: false,
    required: ['native', 'task', 'capability', 'recommendations', 'status', 'lifecycle', 'action', 'actionReason', 'verified', 'fallback'],
    properties: {
      native: { type: 'boolean' },
      task: { type: 'string' },
      capability: { type: 'string' },
      recommendations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['capability', 'package', 'requires', 'status', 'lifecycle', 'reason'],
          properties: {
            capability: { type: 'string' },
            package: { type: 'string' },
            requires: { type: 'array', items: { type: 'string' } },
            status: statusSchema(),
            lifecycle,
            reason: { type: 'string' },
            usage: { type: 'string' },
            fallback: { type: 'string' },
          },
        },
      },
      status: statusSchema(),
      lifecycle,
      action: { type: 'string', enum: ['use', 'activated', 'fallback', 'withheld'] },
      actionReason: { type: 'string' },
      verified: { type: 'boolean' },
      fallback: { type: 'string' },
    },
  }
}

function statusSchema(): Record<string, unknown> {
  return {
    type: 'string',
    enum: ['ready', 'platform-dependent', 'opt-in', 'requires-provider', 'disabled', 'unsupported'],
  }
}
