import type { InstallResult } from './types.js';
export interface InstallSkillOptions {
    target: 'project' | 'dsh';
    cwd?: string;
    dshHome?: string;
}
export declare function installSkill(options: InstallSkillOptions): Promise<InstallResult>;
//# sourceMappingURL=install.d.ts.map