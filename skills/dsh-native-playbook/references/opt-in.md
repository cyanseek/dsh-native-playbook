# Availability and activation

Use these exact meanings:

- `ready`: mounted in the effective profile with the required service path present.
- `platform-dependent`: composition selects an implementation by operating system.
- `opt-in`: shipped upstream but absent from the effective profile or mode.
- `requires-provider`: the consumer/tool exists, but its provider service is not configured.
- `disabled`: the effective profile explicitly turns the capability off.
- `unsupported`: the active DSH version is outside the verified compatibility gate.

Track `shipped`, `mounted`, `visible`, `providerReady`, and `operational` separately. A
visible tool can still lack a provider; a mounted configuration can be ready for the next
process while remaining unavailable in the current one.

When a reviewed activation recipe exists, let `native_capability` plan, apply, verify, and
roll back it automatically. Report its exact effect (`immediate`, `next-turn`, `new-session`,
or `restart`). Do not turn `status` or `verify` into a user chore.

## Recipe 21 — LSP is shipped but unavailable

Task: “Use semantic references,” but the profile has no LSP provider.

Say `requires-provider`, use `grep` as the immediate native fallback, and point to the official provider activation path if semantic accuracy matters. Do not install a third-party code-map plugin automatically.

## Recipe 22 — Reject unnecessary reinvention

Task: “Build a custom plugin for background jobs.”

Show that `bash(run_in_background=true)`, `job_output`, `job_list`, and `job_kill` already cover lifecycle management. Build or install something only if the user's need remains unmet after that comparison.

Package presence proves only that code ships. Use the effective profile, provider rows,
explicit disabled flags, configuration gates, and platform expressions when determining
actual availability. Never inspect or expose credentials to make this decision.
