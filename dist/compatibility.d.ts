import type { DshCompatibility } from './types.js';
export declare const TESTED_DSH_VERSIONS: readonly ["0.1.7-rc.2"];
export interface InspectDshCompatibilityOptions {
    dshCommand?: string;
    cwd?: string;
    version?: string;
}
export declare function inspectDshCompatibility(options?: InspectDshCompatibilityOptions): Promise<DshCompatibility>;
export declare function evaluateDshCompatibility(rawVersion: string): DshCompatibility;
//# sourceMappingURL=compatibility.d.ts.map