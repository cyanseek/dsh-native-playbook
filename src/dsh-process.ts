import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface DshProcessOptions {
  cwd?: string | undefined
  encoding: 'utf8'
  maxBuffer?: number
  timeout?: number
}

export async function execDsh(
  dshCommand: string,
  args: string[],
  options: DshProcessOptions,
): Promise<{ stdout: string; stderr: string }> {
  if (process.platform !== 'win32') {
    const result = await execFileAsync(dshCommand, args, options)
    return { stdout: String(result.stdout), stderr: String(result.stderr) }
  }
  const tokens = [dshCommand, ...args]
  if (tokens.some((token) => /["&|<>^%\r\n!]/.test(token))) {
    throw new Error('DSH command arguments contain unsupported Windows shell characters.')
  }
  const result = await execFileAsync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', dshCommand, ...args], {
    ...options,
    windowsHide: true,
  })
  return { stdout: String(result.stdout), stderr: String(result.stderr) }
}
