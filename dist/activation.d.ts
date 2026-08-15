import type { ActivationPlan, ActivationResult, CapabilityLifecycle } from './types.js';
export interface NativeActivationOptions {
    profile: string;
    dshCommand?: string;
    dshHome?: string;
    cwd?: string;
    version?: string;
    runDsh?: (args: string[]) => Promise<string>;
}
export declare function planNativeActivation(capability: string, options: NativeActivationOptions): Promise<ActivationPlan>;
export declare function activateNativeCapability(capability: string, options: NativeActivationOptions): Promise<ActivationResult>;
export declare function deactivateNativeCapability(capability: string, options: NativeActivationOptions): Promise<ActivationResult>;
export declare function verifyNativeCapability(capability: string, options: NativeActivationOptions): Promise<{
    profile: string;
    capability: string;
    verified: boolean;
    lifecycle?: CapabilityLifecycle;
}>;
export declare function resolveActiveDshProfile(argv: readonly string[]): string | undefined;
//# sourceMappingURL=activation.d.ts.map