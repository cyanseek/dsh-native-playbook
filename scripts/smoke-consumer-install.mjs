#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporary = await mkdtemp(join(tmpdir(), 'dsh-native-consumer-'))
const packageManager = process.env.npm_execpath
if (!packageManager) throw new Error('smoke:consumer must run through pnpm')

try {
  let spec = process.env.DSH_NATIVE_GIT_SPEC
  if (!spec) {
    runPnpm(['pack', '--pack-destination', temporary], root, { npm_config_ignore_scripts: 'true' })
    const tarball = (await readdir(temporary)).find((file) => file.endsWith('.tgz'))
    if (!tarball) throw new Error('pnpm pack did not produce a tarball')
    spec = join(temporary, tarball)
  }

  const install = runPnpm(['add', '--prod', '--ignore-workspace', spec], temporary)
  const installOutput = `${install.stdout}\n${install.stderr}`
  if (/approve-builds|allowBuilds|ignored build scripts/i.test(installOutput)) {
    throw new Error(`Consumer installation requested build approval:\n${installOutput}`)
  }

  const packageRoot = join(temporary, 'node_modules', 'dsh-native-playbook')
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  for (const lifecycle of ['prepare', 'install', 'postinstall']) {
    if (manifest.scripts?.[lifecycle]) throw new Error(`consumer package contains ${lifecycle}`)
  }
  for (const artifact of ['api.js', 'plugin.js', 'session-query.js', 'cli.js']) {
    await readFile(join(packageRoot, 'dist', artifact))
  }
  const api = await import(pathToFileURL(join(packageRoot, 'dist', 'api.js')).href)
  const lookup = await api.lookupNativeCapability('run tests in background')
  if (lookup.mappingId !== 'background-command') throw new Error('installed API lookup failed')

  const cli = spawnSync(process.execPath, [join(packageRoot, 'dist', 'cli.js'), '--version'], {
    cwd: temporary,
    encoding: 'utf8',
  })
  if (cli.status !== 0 || cli.stdout.trim() !== '0.2.1') {
    throw new Error(cli.stderr || `installed CLI returned ${JSON.stringify(cli.stdout)}`)
  }
  process.stdout.write(
    `Consumer install passed for ${process.env.DSH_NATIVE_GIT_SPEC ? spec : basename(spec)} without build approval.\n`,
  )
} finally {
  await rm(temporary, { recursive: true, force: true })
}

function runPnpm(args, cwd, extraEnv = {}) {
  const result = spawnSync(process.execPath, [packageManager, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true', ...extraEnv },
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `pnpm ${args[0]} failed`)
  }
  return result
}
