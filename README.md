# dsh-native-playbook

**Find the DeepSeek Harness capability you already have—and make the safe path usable.**

[![CI](https://github.com/cyanseek/dsh-native-playbook/actions/workflows/ci.yml/badge.svg)](https://github.com/cyanseek/dsh-native-playbook/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

`dsh-native-playbook` is a community plugin for
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), not a separate agent
runtime. It adds one `native_capability` tool that routes a task to official DSH tools,
checks whether the complete capability is operational, and safely activates a reviewed
native path when possible.

[简体中文](./README.zh-CN.md)

## Quick start

Install the prebuilt GitHub package into your DSH profile:

```bash
dsh plugin --profile web add github:cyanseek/dsh-native-playbook
```

Then use DSH normally. Ask for the outcome, not the package:

```text
Run the test suite in the background and tell me when it finishes.
Find every reference to this symbol.
Search previous sessions for the deployment decision.
```

There is no repository clone, local build, build approval, API key, daemon, or manual
verification step in this path. The npm package name is reserved for a later release; until
then, the GitHub command above is the supported install route.

## What changes for common tasks

| Task | Preferred native path | Behavior |
| --- | --- | --- |
| Long-running command | `bash(run_in_background=true)` → `job_output` | Ready on supported Unix-like profiles; use `pwsh` on Windows. |
| Symbol navigation | `lsp` | Uses LSP only with a working provider; otherwise falls back to `grep` and `glob`. |
| Prior-session search | `session_search` | Uses the official workspace-authorized query tools. A reviewed first-use activation is available on tested DSH versions and reports when a DSH restart is required. |
| Delegated investigation | `subagent` → `list_agents` / `send_message` | Uses DSH's built-in child-agent lifecycle. |
| Fixed multi-step work | `workflow` | Prefers the deterministic native workflow engine over shell orchestration. |

The plugin never treats “a package exists” or “a tool name is visible” as proof that a
capability works.

## Readiness you can trust

Every recommendation separates five lifecycle facts:

| Fact | Question answered |
| --- | --- |
| `shipped` | Does the tested DSH catalog include it? |
| `mounted` | Is its tool or service in the effective profile? |
| `visible` | Can the calling Agent currently see it? |
| `providerReady` | Are provider prerequisites actually satisfied? |
| `operational` | Can the Agent use it now? |

The summary state is one of `ready`, `platform-dependent`, `opt-in`,
`requires-provider`, `disabled`, or `unsupported`. Conditional changes also report their
effect as `immediate`, `next-turn`, `new-session`, or `restart`.

## Safe activation

Activation is deliberately narrow:

- Only reviewed recipes shipped in this repository can change a profile.
- The active DSH version must pass an explicit compatibility gate.
- Credentials, security policy, network providers, and arbitrary commands are outside the
  activation surface.
- Every change is checked against DSH and is reversible; failed verification leaves the
  original profile in place.
- Deactivation restores the exact saved content and refuses to overwrite later user edits.

The first Tier-1 recipe enables DSH's official, workspace-authorized session full-text
search with a lazy local index. DSH `0.1.0-rc.6` is the currently verified activation
target. Static lookup remains useful on other versions, while mutation is withheld.

## Agent Skill

The same native-first guidance is available as an Agent Skill:

```bash
npx skills@latest add cyanseek/dsh-native-playbook \
  --skill dsh-native-playbook \
  --agent codex \
  --yes
```

The Skill is focused and loads only the reference needed for the current task.

## CLI

The CLI is an advanced inspection and automation surface. Every command supports stable
JSON output where shown:

```text
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
```

Examples from a development checkout:

```bash
pnpm dsh-native lookup "find all symbol references" --json
pnpm dsh-native status --profile web --json
pnpm dsh-native plan session_search --profile web --json
```

## Node API

```ts
import {
  inspectDshProfile,
  lookupNativeCapability,
  planNativeActivation,
} from 'dsh-native-playbook'

const profile = await inspectDshProfile({ profile: 'web' })
const result = await lookupNativeCapability('run a long test in background', { profile })
const plan = await planNativeActivation('session_search', { profile: 'web' })
```

The public API also exports `listNativeCapabilities`, `explainNativeCapability`,
`activateNativeCapability`, `deactivateNativeCapability`, and
`verifyNativeCapability`. Public API functions never prompt.

## Compatibility and privacy

- Requires Node.js 22 or 24 and DeepSeek Harness.
- Capability facts are pinned to an official DSH source revision.
- Static lookup works without DSH; live readiness needs an existing DSH profile.
- No telemetry is collected.
- No API accesses credential stores or private session contents.
- This project is a community extension and is not affiliated with or endorsed by
  DeepSeek.

## Remove

```bash
dsh plugin --profile web remove dsh-native-playbook
```

## Development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm validate:skill
pnpm validate:plugin
pnpm validate:dsh-plugin
pnpm verify:upstream
pnpm smoke:json
pnpm smoke:consumer
```

CI runs the gates on Linux, macOS, and Windows with Node.js 22 and 24, plus a clean GitHub
consumer-install check.

See [CONTRIBUTING.md](./CONTRIBUTING.md), [SECURITY.md](./SECURITY.md), and
[CHANGELOG.md](./CHANGELOG.md).

## License

[MIT](./LICENSE)
