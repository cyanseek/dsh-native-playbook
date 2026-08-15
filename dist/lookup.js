import { loadTaskMap, loadUpstreamSnapshot } from './catalog.js';
import { NativePlaybookError } from './errors.js';
import { lifecycleFromDefault } from './profile.js';
export async function listNativeCapabilities(profile) {
    const snapshot = await loadUpstreamSnapshot();
    return Object.values(snapshot.tools)
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((tool) => ({
        capability: tool.name,
        package: tool.package,
        requires: tool.requires,
        status: profile?.capabilityStatuses[tool.name] ?? tool.defaultStatus,
        lifecycle: profile?.capabilityLifecycles[tool.name] ?? lifecycleFromDefault(tool),
    }));
}
export async function lookupNativeCapability(task, options = {}) {
    const normalizedTask = normalize(task);
    if (!normalizedTask) {
        throw new NativePlaybookError('NO_NATIVE_MATCH', 'A non-empty task is required.');
    }
    const [taskMap, snapshot] = await Promise.all([loadTaskMap(), loadUpstreamSnapshot()]);
    const matches = taskMap.entries
        .map((entry) => scoreEntry(normalizedTask, entry))
        .filter((match) => match.score > 0)
        .sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id));
    const match = matches[0];
    if (!match) {
        throw new NativePlaybookError('NO_NATIVE_MATCH', `No native DSH mapping matched: ${task}`);
    }
    const recommendations = match.entry.recommendations.map((definition) => {
        const tool = snapshot.tools[definition.capability];
        if (!tool) {
            throw new NativePlaybookError('INVALID_TASK_MAP', `Mapping '${match.entry.id}' references unknown capability '${definition.capability}'.`);
        }
        const profileStatus = options.profile?.capabilityStatuses[tool.name];
        const status = profileStatus ?? definition.statusOverride ?? tool.defaultStatus;
        const lifecycle = options.profile?.capabilityLifecycles[tool.name] ?? lifecycleFromDefault(tool);
        return {
            capability: tool.name,
            package: tool.package,
            requires: tool.requires,
            status,
            lifecycle: status === lifecycle.status ? lifecycle : { ...lifecycle, status },
            reason: definition.reason,
            ...(definition.usage ? { usage: definition.usage } : {}),
            ...(definition.fallback ? { fallback: definition.fallback } : {}),
        };
    });
    return {
        task,
        matchedIntent: match.intent,
        mappingId: match.entry.id,
        category: match.entry.category,
        recommendations,
        externalPluginNeeded: match.entry.externalPluginNeeded,
        upstreamCommit: snapshot.upstreamCommit,
    };
}
export async function explainNativeCapability(capability, profile) {
    const capabilities = await listNativeCapabilities(profile);
    const normalized = capability.trim().toLowerCase();
    const found = capabilities.find((item) => item.capability.toLowerCase() === normalized);
    if (!found) {
        throw new NativePlaybookError('UNKNOWN_CAPABILITY', `Unknown native DSH capability: ${capability}`);
    }
    return found;
}
function scoreEntry(task, entry) {
    let best = { intent: entry.intents[0] ?? '', score: 0 };
    for (const rawIntent of entry.intents) {
        const intent = normalize(rawIntent);
        let score = 0;
        if (task === intent)
            score = 10_000 + intent.length;
        else if (task.includes(intent))
            score = 5_000 + intent.length;
        else if (intent.includes(task) && task.length >= 4)
            score = 2_500 + task.length;
        else {
            const taskTokens = tokenize(task);
            const intentTokens = [...tokenize(intent)];
            const overlap = intentTokens.filter((token) => taskTokens.has(token));
            if (overlap.length > 0) {
                const coverage = overlap.length / intentTokens.length;
                score = overlap.reduce((total, token) => total + Math.max(token.length, 2), 0) * coverage;
            }
            const taskCjk = new Set(cjkBigrams(task));
            const intentCjk = cjkBigrams(intent);
            const cjkOverlap = intentCjk.filter((gram) => taskCjk.has(gram));
            if (cjkOverlap.length >= 2) {
                score = Math.max(score, cjkOverlap.length * 10 * (cjkOverlap.length / intentCjk.length));
            }
        }
        if (score > best.score)
            best = { intent: rawIntent, score };
    }
    return { entry, ...best };
}
function normalize(value) {
    return value
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}_]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}
function tokenize(value) {
    const stopWords = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'the', 'to', 'with', 'i', 'my']);
    return new Set(value.split(' ').filter((token) => token.length > 1 && !stopWords.has(token)));
}
function cjkBigrams(value) {
    const characters = [...value.replace(/[^\p{Script=Han}]/gu, '')];
    return characters.slice(0, -1).map((character, index) => `${character}${characters[index + 1]}`);
}
//# sourceMappingURL=lookup.js.map