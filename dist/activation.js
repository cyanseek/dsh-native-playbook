import { createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, open, readFile, rename, rm, stat, } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { isMap, isSeq, parseDocument } from 'yaml';
import { inspectDshCompatibility } from './compatibility.js';
import { loadUpstreamSnapshot } from './catalog.js';
import { NativePlaybookError } from './errors.js';
import { execDsh } from './dsh-process.js';
import { parseProfileConfig } from './profile.js';
import { findActivationRecipe } from './recipes.js';
export async function planNativeActivation(capability, options) {
    validateProfile(options.profile);
    const [recipe, compatibility] = await Promise.all([
        findActivationRecipe(capability),
        inspectDshCompatibility({
            ...(options.dshCommand ? { dshCommand: options.dshCommand } : {}),
            ...(options.cwd ? { cwd: options.cwd } : {}),
            ...(options.version ? { version: options.version } : {}),
        }),
    ]);
    if (!recipe) {
        return {
            profile: options.profile,
            capability,
            compatibility,
            allowed: false,
            reason: 'No reviewed activation recipe exists for this capability.',
        };
    }
    const recipeSupportsVersion = compatibility.version !== undefined
        && recipe.compatibleDshVersions.includes(compatibility.version);
    const allowed = compatibility.activationAllowed && recipeSupportsVersion;
    return {
        profile: options.profile,
        capability,
        recipe,
        compatibility,
        allowed,
        reason: allowed
            ? 'A reviewed, reversible activation recipe is available for this DSH version.'
            : compatibility.state === 'supported'
                ? `The recipe is not verified for DSH ${compatibility.version}; activation is withheld.`
                : compatibility.reason,
        activationEffect: recipe.activationEffect,
    };
}
export async function activateNativeCapability(capability, options) {
    const plan = await planNativeActivation(capability, options);
    if (!plan.allowed || !plan.recipe)
        return result(plan, 'withheld', false, false);
    const before = await inspectProfile(options);
    const beforeLifecycle = before.capabilityLifecycles[capability];
    if (beforeLifecycle?.status === 'ready') {
        return result(plan, 'already-active', false, true, beforeLifecycle);
    }
    const paths = activationPaths(options, plan.recipe);
    const original = await readOptional(paths.profilePatch);
    const activatedContent = applyAllowlistedRecipe(original.content, plan.recipe);
    if (activatedContent === original.content && original.exists) {
        const verified = await verifyNativeCapability(capability, options);
        return result(plan, verified.verified ? 'already-active' : 'withheld', false, verified.verified, verified.lifecycle);
    }
    const existingSnapshot = await readOptional(paths.snapshot);
    if (existingSnapshot.exists) {
        throw new NativePlaybookError('ACTIVATION_CONFLICT', `Activation state already exists for '${plan.recipe.id}' in profile '${options.profile}'.`);
    }
    const snapshot = {
        schemaVersion: 1,
        recipeId: plan.recipe.id,
        profile: options.profile,
        originalExists: original.exists,
        originalContent: original.content,
        ...(original.mode === undefined ? {} : { originalMode: original.mode }),
        activatedContent,
        activatedHash: hash(activatedContent),
    };
    await mkdir(dirname(paths.snapshot), { recursive: true, mode: 0o700 });
    await atomicWrite(paths.snapshot, `${JSON.stringify(snapshot, null, 2)}\n`, 0o600);
    try {
        await mkdir(dirname(paths.profilePatch), { recursive: true });
        await atomicWrite(paths.profilePatch, activatedContent, original.mode);
        const verified = await verifyNativeCapability(capability, options);
        if (!verified.verified) {
            throw new NativePlaybookError('ACTIVATION_FAILED', `DSH composed the profile, but '${capability}' did not become provider-ready.`);
        }
        return result(plan, 'activated', true, true, verified.lifecycle
            ? { ...verified.lifecycle, activationEffect: plan.recipe.activationEffect }
            : undefined);
    }
    catch (error) {
        await restoreSnapshot(paths.profilePatch, snapshot);
        await rm(paths.snapshot, { force: true });
        throw error instanceof NativePlaybookError
            ? error
            : new NativePlaybookError('ACTIVATION_FAILED', `Could not activate '${capability}'.`, { cause: error });
    }
}
export async function deactivateNativeCapability(capability, options) {
    const plan = await planNativeActivation(capability, options);
    if (!plan.recipe)
        return result(plan, 'unchanged', false, false);
    const paths = activationPaths(options, plan.recipe);
    const state = await readOptional(paths.snapshot);
    if (!state.exists)
        return result(plan, 'unchanged', false, true);
    let snapshot;
    try {
        snapshot = JSON.parse(state.content);
    }
    catch (error) {
        throw new NativePlaybookError('ROLLBACK_FAILED', 'The activation snapshot is not valid JSON.', { cause: error });
    }
    validateSnapshot(snapshot, plan.recipe, options.profile);
    const current = await readOptional(paths.profilePatch);
    if (!current.exists || hash(current.content) !== snapshot.activatedHash) {
        throw new NativePlaybookError('ACTIVATION_CONFLICT', 'The profile patch changed after activation; refusing to overwrite the user\'s newer edits.');
    }
    try {
        await restoreSnapshot(paths.profilePatch, snapshot);
        const restored = await inspectProfile(options);
        const lifecycle = restored.capabilityLifecycles[capability];
        if (lifecycle?.status === 'ready') {
            throw new NativePlaybookError('ROLLBACK_FAILED', `The restored profile still reports '${capability}' as active.`);
        }
        await rm(paths.snapshot, { force: true });
        return result(plan, 'deactivated', true, true, lifecycle);
    }
    catch (error) {
        await atomicWrite(paths.profilePatch, snapshot.activatedContent, current.mode);
        throw new NativePlaybookError('ROLLBACK_FAILED', `Could not restore the pre-activation profile for '${capability}'.`, { cause: error });
    }
}
export async function verifyNativeCapability(capability, options) {
    const inspection = await inspectProfile(options);
    const lifecycle = inspection.capabilityLifecycles[capability];
    return {
        profile: options.profile,
        capability,
        verified: lifecycle?.status === 'ready' && lifecycle.providerReady === true,
        ...(lifecycle ? { lifecycle } : {}),
    };
}
export function resolveActiveDshProfile(argv) {
    const profileIndex = argv.indexOf('--profile');
    if (profileIndex >= 0) {
        const profile = argv[profileIndex + 1];
        return profile && /^[A-Za-z0-9._-]+$/.test(profile) ? profile : undefined;
    }
    return argv[0] === 'web' ? 'web' : undefined;
}
async function inspectProfile(options) {
    const [source, snapshot] = await Promise.all([
        runDsh(options, ['--profile', options.profile, '--dump-config']),
        loadUpstreamSnapshot(),
    ]);
    return parseProfileConfig(options.profile, source, snapshot);
}
function applyAllowlistedRecipe(source, recipe) {
    const document = parseDocument(source.trim() ? source : '[]\n');
    if (document.errors.length > 0 || !isSeq(document.contents)) {
        throw new NativePlaybookError('ACTIVATION_CONFLICT', 'The profile patch must be a valid top-level YAML sequence before it can be changed safely.');
    }
    const desiredProvider = recipe.patches[0];
    const desiredToolPatch = recipe.patches[1];
    if (!desiredProvider || !desiredToolPatch) {
        throw new NativePlaybookError('INVALID_RECIPE', `Recipe '${recipe.id}' has incomplete patches.`);
    }
    if (document.contents.items.length === 0)
        document.contents.flow = false;
    let providerFound = false;
    let toolFound = false;
    for (let index = 0; index < document.contents.items.length; index += 1) {
        const item = document.contents.items[index];
        if (!isMap(item))
            continue;
        const value = item.toJSON();
        if (value.id === 'session-query-sqlite') {
            if (JSON.stringify(value) !== JSON.stringify(desiredProvider)) {
                throw new NativePlaybookError('ACTIVATION_CONFLICT', 'The profile already customizes session-query-sqlite; preserving that user-owned configuration.');
            }
            providerFound = true;
        }
        const insert = item.get('insert', true);
        if (!isSeq(insert))
            continue;
        for (const row of insert.items) {
            if (!isMap(row) || row.get('id') !== 'tool-session-query')
                continue;
            const rowValue = row.toJSON();
            const expectedRow = desiredToolPatch.insert[0];
            if (JSON.stringify(rowValue) !== JSON.stringify(expectedRow)) {
                throw new NativePlaybookError('ACTIVATION_CONFLICT', "The profile already owns a different 'tool-session-query' row.");
            }
            toolFound = true;
        }
    }
    if (!providerFound)
        document.add(desiredProvider);
    if (!toolFound)
        document.add(desiredToolPatch);
    const rendered = document.toString();
    return rendered.endsWith('\n') ? rendered : `${rendered}\n`;
}
async function runDsh(options, args) {
    if (options.runDsh)
        return options.runDsh(args);
    try {
        const { stdout } = await execDsh(options.dshCommand ?? 'dsh', args, {
            cwd: options.cwd,
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024,
            timeout: 30_000,
        });
        return stdout;
    }
    catch (error) {
        throw new NativePlaybookError('PROFILE_INSPECTION_FAILED', `Could not compose DSH profile '${options.profile}'.`, { cause: error });
    }
}
function activationPaths(options, recipe) {
    const dshHome = options.dshHome ?? process.env.DSH_HOME ?? join(homedir(), '.dsh');
    return {
        profilePatch: join(dshHome, 'profiles', options.profile, 'cordis.patch.yml'),
        snapshot: join(dshHome, 'native-playbook', 'activation-snapshots', options.profile, `${recipe.id}.json`),
    };
}
async function readOptional(filename) {
    try {
        const [content, metadata] = await Promise.all([readFile(filename, 'utf8'), stat(filename)]);
        return { exists: true, content, mode: metadata.mode & 0o777 };
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return { exists: false, content: '' };
        throw error;
    }
}
async function atomicWrite(filename, content, mode = 0o600) {
    const temporary = join(dirname(filename), `.${randomBytes(12).toString('hex')}.tmp`);
    const handle = await open(temporary, 'wx', mode);
    try {
        await handle.writeFile(content, 'utf8');
        await handle.sync();
    }
    finally {
        await handle.close();
    }
    try {
        await rename(temporary, filename);
        await chmod(filename, mode);
    }
    catch (error) {
        await rm(temporary, { force: true });
        throw error;
    }
}
async function restoreSnapshot(filename, snapshot) {
    if (snapshot.originalExists) {
        await atomicWrite(filename, snapshot.originalContent, snapshot.originalMode);
    }
    else {
        await rm(filename, { force: true });
    }
    const restored = await readOptional(filename);
    if (restored.exists !== snapshot.originalExists || restored.content !== snapshot.originalContent) {
        throw new NativePlaybookError('ROLLBACK_FAILED', 'The profile snapshot could not be restored exactly.');
    }
}
function validateSnapshot(snapshot, recipe, profile) {
    if (snapshot.schemaVersion !== 1
        || snapshot.recipeId !== recipe.id
        || snapshot.profile !== profile
        || typeof snapshot.originalExists !== 'boolean'
        || typeof snapshot.originalContent !== 'string'
        || typeof snapshot.activatedContent !== 'string'
        || typeof snapshot.activatedHash !== 'string'
        || hash(snapshot.activatedContent) !== snapshot.activatedHash) {
        throw new NativePlaybookError('ROLLBACK_FAILED', 'The activation snapshot failed integrity validation.');
    }
}
function result(plan, action, changed, verified, lifecycle) {
    return { ...plan, action, changed, verified, ...(lifecycle ? { lifecycle } : {}) };
}
function hash(content) {
    return createHash('sha256').update(content).digest('hex');
}
function validateProfile(profile) {
    if (!/^[A-Za-z0-9._-]+$/.test(profile)) {
        throw new NativePlaybookError('PROFILE_NOT_FOUND', `Invalid DSH profile name: ${profile}`);
    }
}
//# sourceMappingURL=activation.js.map