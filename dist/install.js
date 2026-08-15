import { access, cp, lstat, mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { resolvePackageFile } from './catalog.js';
import { NativePlaybookError } from './errors.js';
export async function installSkill(options) {
    const source = resolvePackageFile('skills/dsh-native-playbook');
    const root = options.target === 'project'
        ? join(options.cwd ?? process.cwd(), '.agents', 'skills')
        : join(options.dshHome ?? process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'skills');
    const destination = join(root, 'dsh-native-playbook');
    try {
        await access(join(source, 'SKILL.md'));
        const updated = await validateDestination(destination);
        await mkdir(root, { recursive: true });
        await cp(source, destination, { recursive: true, force: true, errorOnExist: false });
        return { target: options.target, path: destination, updated };
    }
    catch (error) {
        if (error instanceof NativePlaybookError)
            throw error;
        throw new NativePlaybookError('SKILL_INSTALL_FAILED', `Could not install Skill at ${destination}.`, {
            cause: error,
        });
    }
}
async function validateDestination(destination) {
    let stat;
    try {
        stat = await lstat(destination);
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return false;
        throw error;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new NativePlaybookError('SKILL_INSTALL_FAILED', `Refusing to overwrite non-directory destination: ${destination}`);
    }
    let current;
    try {
        current = await readFile(join(destination, 'SKILL.md'), 'utf8');
    }
    catch (error) {
        throw new NativePlaybookError('SKILL_INSTALL_FAILED', `Refusing to overwrite a directory without an owned SKILL.md: ${destination}`, { cause: error });
    }
    if (!/^name:\s*dsh-native-playbook\s*$/m.test(current)) {
        throw new NativePlaybookError('SKILL_INSTALL_FAILED', `Refusing to overwrite a Skill not owned by dsh-native-playbook: ${destination}`);
    }
    return true;
}
//# sourceMappingURL=install.js.map