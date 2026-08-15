import type { DshCompatibility } from './types.js'
import { execDsh } from './dsh-process.js'

export const TESTED_DSH_VERSIONS = ['0.1.0-rc.5', '0.1.0-rc.6'] as const

export interface InspectDshCompatibilityOptions {
  dshCommand?: string
  cwd?: string
  version?: string
}

export async function inspectDshCompatibility(
  options: InspectDshCompatibilityOptions = {},
): Promise<DshCompatibility> {
  if (options.version !== undefined) return evaluateDshCompatibility(options.version)
  try {
    const { stdout } = await execDsh(options.dshCommand ?? 'dsh', ['--version'], {
      cwd: options.cwd,
      encoding: 'utf8',
      timeout: 15_000,
    })
    return evaluateDshCompatibility(stdout)
  } catch {
    return {
      state: 'unknown',
      activationAllowed: false,
      testedVersions: [...TESTED_DSH_VERSIONS],
      reason: 'The DSH version could not be read. Lookup remains available, but activation is withheld.',
    }
  }
}

export function evaluateDshCompatibility(rawVersion: string): DshCompatibility {
  const version = rawVersion.trim().match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/)?.[0]
  if (!version) {
    return {
      state: 'unknown',
      activationAllowed: false,
      testedVersions: [...TESTED_DSH_VERSIONS],
      reason: 'The DSH version output was not recognized. Lookup remains available, but activation is withheld.',
    }
  }
  const supported = TESTED_DSH_VERSIONS.includes(version as (typeof TESTED_DSH_VERSIONS)[number])
  return {
    version,
    state: supported ? 'supported' : 'unsupported',
    activationAllowed: supported,
    testedVersions: [...TESTED_DSH_VERSIONS],
    reason: supported
      ? `DSH ${version} is covered by the compatibility gate.`
      : `DSH ${version} is outside the tested compatibility gate; activation is withheld.`,
  }
}
