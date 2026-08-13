import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { installSkill, NativePlaybookError } from '../src/api.js'

test('installs and updates the project Skill', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-native-project-'))
  const first = await installSkill({ target: 'project', cwd: directory })
  assert.equal(first.updated, false)
  assert.equal(first.path, join(directory, '.agents', 'skills', 'dsh-native-playbook'))
  assert.match(await readFile(join(first.path, 'SKILL.md'), 'utf8'), /name: dsh-native-playbook/)

  const second = await installSkill({ target: 'project', cwd: directory })
  assert.equal(second.updated, true)
})

test('installs to an isolated DSH home', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-native-home-'))
  const result = await installSkill({ target: 'dsh', dshHome: directory })
  assert.equal(result.path, join(directory, 'skills', 'dsh-native-playbook'))
  assert.match(await readFile(join(result.path, 'SKILL.md'), 'utf8'), /native capabilities/i)
})

test('refuses to overwrite a Skill owned by another project', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-native-collision-'))
  const target = join(directory, '.agents', 'skills', 'dsh-native-playbook')
  await mkdir(target, { recursive: true })
  await writeFile(join(target, 'SKILL.md'), '---\nname: another-skill\n---\n', 'utf8')
  await assert.rejects(
    installSkill({ target: 'project', cwd: directory }),
    (error: unknown) =>
      error instanceof NativePlaybookError && error.code === 'SKILL_INSTALL_FAILED',
  )
})

test('refuses an existing destination with no SKILL.md', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-native-unowned-directory-'))
  const target = join(directory, '.agents', 'skills', 'dsh-native-playbook')
  await mkdir(target, { recursive: true })
  await assert.rejects(
    installSkill({ target: 'project', cwd: directory }),
    (error: unknown) =>
      error instanceof NativePlaybookError && error.code === 'SKILL_INSTALL_FAILED',
  )
})
