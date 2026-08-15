import type { CapabilityLifecycle, CapabilityStatus, NativeRecommendation } from './types.js';
export declare const name = "dsh-native-playbook";
export declare const inject: string[];
export interface NativeCapabilityToolResult {
    native: boolean;
    task: string;
    capability: string;
    recommendations: NativeRecommendation[];
    status: CapabilityStatus;
    lifecycle: CapabilityLifecycle;
    action: 'use' | 'activated' | 'fallback' | 'withheld';
    actionReason: string;
    verified: boolean;
    fallback: string;
}
interface RuntimeToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    output: {
        schema: Record<string, unknown>;
        render(args: unknown, value: unknown): Array<{
            type: 'text';
            text: string;
        }>;
    };
    execute(args: {
        task: string;
    }, exec: {
        agent?: unknown;
    }): Promise<NativeCapabilityToolResult>;
    isConcurrencySafe(): boolean;
    presentCall(args: {
        task: string;
    }): {
        card: 'generic';
        title: string;
        kind: 'search';
        rawInput: string;
    };
}
interface RuntimeContext {
    tools: {
        register(definition: RuntimeToolDefinition): unknown;
        schemas(scope?: unknown): Array<{
            name: string;
        }>;
    };
    systemPrompt: {
        section(section: {
            name: string;
            order: number;
            text: string;
        }): unknown;
    };
}
export declare function apply(ctx: RuntimeContext): void;
export {};
//# sourceMappingURL=plugin.d.ts.map