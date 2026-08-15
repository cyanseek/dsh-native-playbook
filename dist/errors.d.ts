export type ErrorCode = 'DSH_NOT_FOUND' | 'PROFILE_NOT_FOUND' | 'UPSTREAM_FETCH_FAILED' | 'UPSTREAM_PARSE_FAILED' | 'STALE_UPSTREAM_SNAPSHOT' | 'UNKNOWN_CAPABILITY' | 'NO_NATIVE_MATCH' | 'PROFILE_INSPECTION_FAILED' | 'SKILL_INSTALL_FAILED' | 'INVALID_TASK_MAP' | 'INVALID_SKILL' | 'COMPATIBILITY_UNKNOWN' | 'ACTIVATION_NOT_ALLOWED' | 'ACTIVATION_CONFLICT' | 'ACTIVATION_FAILED' | 'ROLLBACK_FAILED' | 'INVALID_RECIPE';
export declare class NativePlaybookError extends Error {
    readonly code: ErrorCode;
    constructor(code: ErrorCode, message: string, options?: ErrorOptions);
}
export declare function asNativePlaybookError(error: unknown): NativePlaybookError;
//# sourceMappingURL=errors.d.ts.map