import type { LookupResult, NativeCapability, ProfileInspection } from './types.js';
export declare function listNativeCapabilities(profile?: ProfileInspection): Promise<NativeCapability[]>;
export declare function lookupNativeCapability(task: string, options?: {
    profile?: ProfileInspection;
}): Promise<LookupResult>;
export declare function explainNativeCapability(capability: string, profile?: ProfileInspection): Promise<NativeCapability>;
//# sourceMappingURL=lookup.d.ts.map