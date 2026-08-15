#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { activateNativeCapability, deactivateNativeCapability, explainNativeCapability, listNativeCapabilities, loadUpstreamSnapshot, lookupNativeCapability, planNativeActivation, verifyNativeCapability, } from './api.js';
import { asNativePlaybookError, NativePlaybookError } from './errors.js';
import { installSkill } from './install.js';
import { inspectDshProfile } from './profile.js';
async function main(argv) {
    const args = parseArguments(argv);
    if (!args.command || args.command === 'help' || args.command === '--help') {
        printHelp();
        return;
    }
    if (args.command === '--version' || args.command === '-V') {
        process.stdout.write('0.2.1\n');
        return;
    }
    switch (args.command) {
        case 'lookup': {
            const profile = args.profile ? await inspectDshProfile({ profile: args.profile }) : undefined;
            const task = args.positionals.join(' ').trim();
            const result = await lookupNativeCapability(task, { ...(profile ? { profile } : {}) });
            emit(args.json, result, formatLookup(result));
            return;
        }
        case 'status': {
            const profile = args.profile ? await inspectDshProfile({ profile: args.profile }) : undefined;
            if (!profile || !args.profile) {
                throw new NativePlaybookError('PROFILE_NOT_FOUND', 'status requires --profile <name>.');
            }
            const capabilities = await listNativeCapabilities(profile);
            emit(args.json, { profile: args.profile, capabilities }, formatCapabilities(capabilities));
            return;
        }
        case 'list': {
            const profile = args.profile ? await inspectDshProfile({ profile: args.profile }) : undefined;
            const capabilities = await listNativeCapabilities(profile);
            emit(args.json, { capabilities }, formatCapabilities(capabilities));
            return;
        }
        case 'explain': {
            const profile = args.profile ? await inspectDshProfile({ profile: args.profile }) : undefined;
            const name = args.positionals[0];
            if (!name)
                throw new NativePlaybookError('UNKNOWN_CAPABILITY', 'explain requires a capability name.');
            const capability = await explainNativeCapability(name, profile);
            emit(args.json, capability, formatCapabilities([capability]));
            return;
        }
        case 'plan': {
            const capability = requireCapability(args);
            const profileName = requireProfile(args, 'plan');
            const result = await planNativeActivation(capability, { profile: profileName });
            emit(args.json, result, formatActivation(result));
            return;
        }
        case 'activate': {
            const capability = requireCapability(args);
            const profileName = requireProfile(args, 'activate');
            const result = await activateNativeCapability(capability, { profile: profileName });
            emit(args.json, result, formatActivation(result));
            return;
        }
        case 'deactivate': {
            const capability = requireCapability(args);
            const profileName = requireProfile(args, 'deactivate');
            const result = await deactivateNativeCapability(capability, { profile: profileName });
            emit(args.json, result, formatActivation(result));
            return;
        }
        case 'verify': {
            const capability = requireCapability(args);
            const profileName = requireProfile(args, 'verify');
            const result = await verifyNativeCapability(capability, { profile: profileName });
            emit(args.json, result, `${result.verified ? '✓' : '○'} ${capability}: ${result.lifecycle?.reason ?? 'not found in the pinned catalog'}`);
            return;
        }
        case 'doctor': {
            const snapshot = await loadUpstreamSnapshot();
            const probe = spawnSync('dsh', ['--version'], { encoding: 'utf8' });
            const dsh = probe.error && probe.error.code === 'ENOENT'
                ? { available: false, code: 'DSH_NOT_FOUND' }
                : { available: probe.status === 0, version: probe.stdout.trim() || undefined };
            const result = {
                ok: true,
                snapshot: { upstreamCommit: snapshot.upstreamCommit, tools: Object.keys(snapshot.tools).length },
                dsh,
            };
            emit(args.json, result, [
                `Upstream snapshot: ${snapshot.upstreamCommit}`,
                `Native tools: ${Object.keys(snapshot.tools).length}`,
                `DSH CLI: ${dsh.available ? dsh.version ?? 'available' : 'not found (static lookup still works)'}`,
            ].join('\n'));
            return;
        }
        case 'install': {
            if (!args.target) {
                throw new NativePlaybookError('SKILL_INSTALL_FAILED', 'install requires --target project|dsh.');
            }
            const result = await installSkill({ target: args.target });
            emit(args.json, result, `${result.updated ? 'Updated' : 'Installed'} Skill at ${result.path}`);
            return;
        }
        default:
            throw new NativePlaybookError('NO_NATIVE_MATCH', `Unknown command: ${args.command}`);
    }
}
function parseArguments(argv) {
    const result = { positionals: [], json: false };
    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index];
        if (!value)
            continue;
        if (!result.command &&
            (value === '--help' || value === '--version' || value === '-V')) {
            result.command = value;
        }
        else if (!result.command && !value.startsWith('--')) {
            result.command = value;
        }
        else if (value === '--json') {
            result.json = true;
        }
        else if (value === '--profile') {
            const profile = argv[index + 1];
            if (!profile)
                throw new NativePlaybookError('PROFILE_NOT_FOUND', '--profile requires a value.');
            result.profile = profile;
            index += 1;
        }
        else if (value === '--target') {
            const target = argv[index + 1];
            if (target !== 'project' && target !== 'dsh') {
                throw new NativePlaybookError('SKILL_INSTALL_FAILED', '--target must be project or dsh.');
            }
            result.target = target;
            index += 1;
        }
        else if (value.startsWith('--')) {
            throw new NativePlaybookError('NO_NATIVE_MATCH', `Unknown option: ${value}`);
        }
        else {
            result.positionals.push(value);
        }
    }
    return result;
}
function formatLookup(result) {
    const lines = [`Task: ${result.task}`, `Matched: ${result.mappingId}`, 'Native recommendation:'];
    for (const item of result.recommendations) {
        lines.push(`  ${statusMark(item.status)} ${item.capability} [${item.status}]${item.usage ? ` — ${item.usage}` : ''}`);
        lines.push(`    ${item.reason}`);
        if (item.fallback)
            lines.push(`    Fallback: ${item.fallback}`);
    }
    lines.push(`External plugin needed: ${result.externalPluginNeeded ? 'yes' : 'no'}`);
    return lines.join('\n');
}
function formatCapabilities(capabilities) {
    return capabilities
        .map((item) => `${statusMark(item.status)} ${item.capability.padEnd(24)} ${item.status}`)
        .join('\n');
}
function formatActivation(value) {
    return [
        `${value.capability} on profile ${value.profile}: ${value.action ?? (value.allowed ? 'available' : 'withheld')}`,
        value.reason,
        ...(value.activationEffect ? [`Effect: ${value.activationEffect}`] : []),
    ].join('\n');
}
function requireCapability(args) {
    const capability = args.positionals[0];
    if (!capability)
        throw new NativePlaybookError('UNKNOWN_CAPABILITY', `${args.command} requires a capability name.`);
    return capability;
}
function requireProfile(args, command) {
    if (!args.profile)
        throw new NativePlaybookError('PROFILE_NOT_FOUND', `${command} requires --profile <name>.`);
    return args.profile;
}
function statusMark(status) {
    if (status === 'ready')
        return '✓';
    if (status === 'platform-dependent' || status === 'requires-provider')
        return '◐';
    return '○';
}
function emit(json, value, text) {
    process.stdout.write(json ? `${JSON.stringify(value, null, 2)}\n` : `${text}\n`);
}
function printHelp() {
    process.stdout.write(`dsh-native — map tasks to native DeepSeek Harness capabilities

Usage:
  dsh-native lookup "<task>" [--profile <name>] [--json]
  dsh-native status --profile <name> [--json]
  dsh-native list [--profile <name>] [--json]
  dsh-native explain <capability> [--profile <name>] [--json]
  dsh-native doctor [--json]
  dsh-native install --target project|dsh [--json]
  dsh-native plan <capability> --profile <name> [--json]
  dsh-native activate <capability> --profile <name> [--json]
  dsh-native deactivate <capability> --profile <name> [--json]
  dsh-native verify <capability> --profile <name> [--json]
`);
}
main(process.argv.slice(2)).catch((error) => {
    const nativeError = asNativePlaybookError(error);
    const wantsJson = process.argv.includes('--json');
    if (wantsJson) {
        process.stdout.write(`${JSON.stringify({ error: { code: nativeError.code, message: nativeError.message } })}\n`);
    }
    else {
        process.stderr.write(`${nativeError.code}: ${nativeError.message}\n`);
    }
    process.exitCode = 1;
});
//# sourceMappingURL=cli.js.map