export type CapabilityStatus =
  | 'ready'
  | 'platform-dependent'
  | 'opt-in'
  | 'requires-provider'
  | 'disabled'

export interface UpstreamTool {
  name: string
  package: string
  requires: string[]
  defaultStatus: CapabilityStatus
}

export interface UpstreamPlugin {
  id: string
  package: string
  disabled: boolean | 'platform-dependent'
}

export interface UpstreamSnapshot {
  schemaVersion: 1
  sourceRepository: string
  upstreamCommit: string
  generatedAt: string
  sources: string[]
  tools: Record<string, UpstreamTool>
  basePlugins: Record<string, UpstreamPlugin>
}

export interface TaskRecommendationDefinition {
  capability: string
  usage?: string
  fallback?: string
  reason: string
  statusOverride?: CapabilityStatus
}

export interface TaskMapEntry {
  id: string
  category: string
  intents: string[]
  recommendations: TaskRecommendationDefinition[]
  externalPluginNeeded: boolean
}

export interface TaskMap {
  version: 1
  entries: TaskMapEntry[]
}

export interface ProfileRow {
  id: string
  package: string
  disabled: boolean | 'platform-dependent'
  raw: string
}

export interface ProfileInspection {
  profile: string
  rows: ProfileRow[]
  capabilityStatuses: Record<string, CapabilityStatus>
}

export interface NativeCapability {
  capability: string
  package: string
  requires: string[]
  status: CapabilityStatus
}

export interface NativeRecommendation extends NativeCapability {
  usage?: string
  fallback?: string
  reason: string
}

export interface LookupResult {
  task: string
  matchedIntent: string
  mappingId: string
  category: string
  recommendations: NativeRecommendation[]
  externalPluginNeeded: boolean
  upstreamCommit: string
}

export interface InstallResult {
  target: 'project' | 'dsh'
  path: string
  updated: boolean
}
