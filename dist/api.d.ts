export { loadTaskMap, loadUpstreamSnapshot } from './catalog.js';
export { explainNativeCapability, listNativeCapabilities, lookupNativeCapability } from './lookup.js';
export { inspectDshProfile, parseProfileConfig, parseRows } from './profile.js';
export { evaluateDshCompatibility, inspectDshCompatibility, TESTED_DSH_VERSIONS } from './compatibility.js';
export { findActivationRecipe, listActivationRecipes } from './recipes.js';
export { activateNativeCapability, deactivateNativeCapability, planNativeActivation, resolveActiveDshProfile, verifyNativeCapability, } from './activation.js';
export type { NativeActivationOptions } from './activation.js';
export { installSkill } from './install.js';
export { NativePlaybookError } from './errors.js';
export type { CapabilityStatus, CapabilityLifecycle, CompatibilityState, DshCompatibility, ActivationEffect, ActivationPlan, ActivationRecipe, ActivationResult, InstallResult, LookupResult, NativeCapability, NativeRecommendation, ProfileInspection, TaskMap, TaskMapEntry, UpstreamSnapshot, } from './types.js';
//# sourceMappingURL=api.d.ts.map