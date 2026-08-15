export class NativePlaybookError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.name = 'NativePlaybookError';
        this.code = code;
    }
}
export function asNativePlaybookError(error) {
    if (error instanceof NativePlaybookError)
        return error;
    return new NativePlaybookError('PROFILE_INSPECTION_FAILED', error instanceof Error ? error.message : String(error), error instanceof Error ? { cause: error } : undefined);
}
//# sourceMappingURL=errors.js.map