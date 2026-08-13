import { listNativeCapabilities, lookupNativeCapability } from './lookup.js'
import { NativePlaybookError } from './errors.js'
import type { CapabilityStatus, NativeRecommendation, ProfileInspection } from './types.js'

export const name = 'dsh-native-playbook'
export const inject = ['tools']

export interface NativeCapabilityToolResult {
  native: boolean
  recommendations: NativeRecommendation[]
  status: CapabilityStatus
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
}

export function apply(ctx: RuntimeContext): void {
  ctx.tools.register({
    name: 'native_capability',
    description: 'Map a task to built-in DeepSeek Harness capabilities before installing another plugin or writing a workaround.',
    parameters: {
      task: {
        type: 'string',
        required: true,
        description: 'The task or intent to match against native DSH capabilities.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['native', 'recommendations', 'status'],
        properties: {
          native: { type: 'boolean' },
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['capability', 'package', 'requires', 'status', 'reason'],
              properties: {
                capability: { type: 'string' },
                package: { type: 'string' },
                requires: { type: 'array', items: { type: 'string' } },
                status: {
                  type: 'string',
                  enum: ['ready', 'platform-dependent', 'opt-in', 'requires-provider', 'disabled'],
                },
                reason: { type: 'string' },
                usage: { type: 'string' },
                fallback: { type: 'string' },
              },
            },
          },
          status: {
            type: 'string',
            enum: ['ready', 'platform-dependent', 'opt-in', 'requires-provider', 'disabled'],
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) ?? 'null' }],
    },
    async execute(args, exec) {
      const capabilities = await listNativeCapabilities()
      const visible = new Set(ctx.tools.schemas(exec.agent).map((schema) => schema.name))
      const profile: ProfileInspection = {
        profile: 'active-runtime',
        rows: [],
        capabilityStatuses: Object.fromEntries(
          capabilities.map((capability) => [
            capability.capability,
            visible.has(capability.capability) ? 'ready' : 'opt-in',
          ]),
        ),
      }
      const result = await lookupNativeCapability(args.task, { profile })
      const primary = result.recommendations[0]
      if (!primary) {
        throw new NativePlaybookError(
          'INVALID_TASK_MAP',
          `Mapping '${result.mappingId}' has no native recommendations.`,
        )
      }
      return {
        native: !result.externalPluginNeeded,
        recommendations: result.recommendations,
        status: primary.status,
      }
    },
    isConcurrencySafe: () => true,
    presentCall: (args) => ({
      card: 'generic',
      title: 'Check native DSH capability',
      kind: 'search',
      rawInput: args.task,
    }),
  })
}
