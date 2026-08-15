export interface DshProcessOptions {
    cwd?: string | undefined;
    encoding: 'utf8';
    maxBuffer?: number;
    timeout?: number;
}
export declare function execDsh(dshCommand: string, args: string[], options: DshProcessOptions): Promise<{
    stdout: string;
    stderr: string;
}>;
//# sourceMappingURL=dsh-process.d.ts.map