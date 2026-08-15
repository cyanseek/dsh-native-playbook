export type CapabilityStatus = 'ready' | 'platform-dependent' | 'opt-in' | 'requires-provider' | 'disabled' | 'unsupported';
export type TriState = boolean | 'unknown';
export type ActivationEffect = 'immediate' | 'next-turn' | 'new-session' | 'restart';
export interface CapabilityLifecycle {
    shipped: boolean;
    mounted: TriState;
    visible: TriState;
    providerReady: TriState;
    operational: TriState;
    status: CapabilityStatus;
    activationEffect?: ActivationEffect;
    reason: string;
}
export type CompatibilityState = 'supported' | 'unsupported' | 'unknown';
export interface DshCompatibility {
    version?: string;
    state: CompatibilityState;
    activationAllowed: boolean;
    testedVersions: string[];
    reason: string;
}
export interface UpstreamTool {
    name: string;
    package: string;
    requires: string[];
    defaultStatus: CapabilityStatus;
}
export interface UpstreamPlugin {
    id: string;
    package: string;
    disabled: boolean | 'platform-dependent';
}
export interface UpstreamSnapshot {
    schemaVersion: 1;
    sourceRepository: string;
    upstreamCommit: string;
    generatedAt: string;
    sources: string[];
    tools: Record<string, UpstreamTool>;
    basePlugins: Record<string, UpstreamPlugin>;
}
export interface TaskRecommendationDefinition {
    capability: string;
    usage?: string;
    fallback?: string;
    reason: string;
    statusOverride?: CapabilityStatus;
}
export interface TaskMapEntry {
    id: string;
    category: string;
    intents: string[];
    recommendations: TaskRecommendationDefinition[];
    externalPluginNeeded: boolean;
}
export interface TaskMap {
    version: 1;
    entries: TaskMapEntry[];
}
export interface ProfileRow {
    id: string;
    package: string;
    disabled: boolean | 'platform-dependent';
    raw: string;
}
export interface ProfileInspection {
    profile: string;
    rows: ProfileRow[];
    capabilityStatuses: Record<string, CapabilityStatus>;
    capabilityLifecycles: Record<string, CapabilityLifecycle>;
}
export interface NativeCapability {
    capability: string;
    package: string;
    requires: string[];
    status: CapabilityStatus;
    lifecycle: CapabilityLifecycle;
}
export interface NativeRecommendation extends NativeCapability {
    usage?: string;
    fallback?: string;
    reason: string;
}
export interface LookupResult {
    task: string;
    matchedIntent: string;
    mappingId: string;
    category: string;
    recommendations: NativeRecommendation[];
    externalPluginNeeded: boolean;
    upstreamCommit: string;
}
export interface ActivationRecipe {
    schemaVersion: 1;
    id: string;
    capability: string;
    provides: string[];
    description: string;
    upstreamEvidence: string[];
    compatibleDshVersions: string[];
    preconditions: string[];
    risk: 'low';
    activationEffect: ActivationEffect;
    patches: Array<Record<string, unknown>>;
    verification: string[];
    rollback: 'restore-snapshot';
}
export interface ActivationPlan {
    profile: string;
    capability: string;
    recipe?: ActivationRecipe;
    compatibility: DshCompatibility;
    allowed: boolean;
    reason: string;
    activationEffect?: ActivationEffect;
}
export interface ActivationResult extends ActivationPlan {
    action: 'activated' | 'already-active' | 'deactivated' | 'unchanged' | 'withheld';
    changed: boolean;
    verified: boolean;
    lifecycle?: CapabilityLifecycle;
}
export interface InstallResult {
    target: 'project' | 'dsh';
    path: string;
    updated: boolean;
}
//# sourceMappingURL=types.d.ts.map