export type ErrorCode =
  | 'DSH_NOT_FOUND'
  | 'PROFILE_NOT_FOUND'
  | 'UPSTREAM_FETCH_FAILED'
  | 'UPSTREAM_PARSE_FAILED'
  | 'STALE_UPSTREAM_SNAPSHOT'
  | 'UNKNOWN_CAPABILITY'
  | 'NO_NATIVE_MATCH'
  | 'PROFILE_INSPECTION_FAILED'
  | 'SKILL_INSTALL_FAILED'
  | 'INVALID_TASK_MAP'
  | 'INVALID_SKILL'

export class NativePlaybookError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'NativePlaybookError'
    this.code = code
  }
}

export function asNativePlaybookError(error: unknown): NativePlaybookError {
  if (error instanceof NativePlaybookError) return error
  return new NativePlaybookError(
    'PROFILE_INSPECTION_FAILED',
    error instanceof Error ? error.message : String(error),
    error instanceof Error ? { cause: error } : undefined,
  )
}
