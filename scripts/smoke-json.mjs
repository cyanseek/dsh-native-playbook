#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const binary = join(root, 'dist', 'cli.js')
const installDirectory = await mkdtemp(join(tmpdir(), 'dsh-native-cli-'))

try {
  const lookup = run(['lookup', 'run tests in background', '--json'])
  const list = run(['list', '--json'])
  const explain = run(['explain', 'subagent', '--json'])
  const doctor = run(['doctor', '--json'])
  const install = run(['install', '--target', 'project', '--json'], installDirectory)
  const help = run(['--help'])
  const version = run(['--version'])
  for (const result of [lookup, list, explain, doctor, install, help, version]) {
    if (result.status !== 0) fail(result)
  }

  const lookupValue = JSON.parse(lookup.stdout)
  const listValue = JSON.parse(list.stdout)
  const explainValue = JSON.parse(explain.stdout)
  const doctorValue = JSON.parse(doctor.stdout)
  const installValue = JSON.parse(install.stdout)
  if (lookupValue.mappingId !== 'background-command' || lookupValue.externalPluginNeeded !== false) {
    throw new Error('CLI JSON smoke returned the wrong native mapping.')
  }
  if (!Array.isArray(listValue.capabilities) || explainValue.capability !== 'subagent') {
    throw new Error('Legacy list or explain command returned an invalid JSON contract.')
  }
  if (doctorValue.ok !== true || installValue.target !== 'project') {
    throw new Error('Legacy doctor or install command returned an invalid JSON contract.')
  }

  for (const command of ['status', 'plan', 'activate', 'deactivate', 'verify']) {
    const args = command === 'status' ? [command, '--json'] : [command, 'session_search', '--json']
    const result = run(args)
    if (result.status !== 1) fail(result)
    const value = JSON.parse(result.stdout)
    if (value.error?.code !== 'PROFILE_NOT_FOUND') {
      throw new Error(`${command} did not preserve pure JSON on a validation error.`)
    }
  }

  if (!help.stdout.startsWith('dsh-native') || version.stdout.trim() !== '0.2.1') {
    throw new Error('CLI help or version smoke failed.')
  }
  process.stdout.write('CLI JSON smoke passed.\n')
} finally {
  await rm(installDirectory, { recursive: true, force: true })
}

function run(args, cwd = root) {
  return spawnSync(process.execPath, [binary, ...args], { cwd, encoding: 'utf8' })
}

function fail(result) {
  throw new Error(result.stderr || result.stdout || 'CLI JSON smoke failed.')
}
