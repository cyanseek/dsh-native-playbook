import type { CapabilityLifecycle, ProfileInspection, ProfileRow, UpstreamSnapshot, UpstreamTool } from './types.js';
export interface InspectProfileOptions {
    profile: string;
    dshCommand?: string;
    cwd?: string;
    visibleCapabilities?: Iterable<string>;
}
export declare function inspectDshProfile(options: InspectProfileOptions): Promise<ProfileInspection>;
export declare function parseProfileConfig(profile: string, source: string, snapshot: UpstreamSnapshot, visibleCapabilities?: Iterable<string>): ProfileInspection;
export declare function parseRows(source: string): ProfileRow[];
export declare function resolveCapabilityLifecycle(tool: UpstreamTool, rows: ProfileRow[], visibleCapabilities?: ReadonlySet<string>): CapabilityLifecycle;
export declare function lifecycleFromDefault(tool: UpstreamTool): CapabilityLifecycle;
//# sourceMappingURL=profile.d.ts.map