# dsh-native-playbook

**Use what DeepSeek Harness already ships before reinventing it.**

DeepSeek Harness already includes file editing, code search, background jobs, subagents,
workflows, Ralph loops, goals, web search, LSP seams, session queries, and more. This
plugin tells humans and coding agents **which native capability fits the task** and
**whether the current DSH profile can actually use it**.

> task → native capability → current availability → use it

[简体中文](./README.zh-CN.md)

![A terminal lookup maps a background test task to native bash and job output capabilities.](./assets/demo.svg)

## Three common tasks

```text
Run tests in the background
→ bash(run_in_background=true) → job_output

Find every symbol reference
→ lsp → grep fallback when no provider is configured

Let another Agent investigate while I keep working
→ subagent → list_agents / send_message
```

No manual PID manager. No immediate code-map plugin. No custom multi-agent script.

## Quick start

### Install as a DSH plugin

Install the GitHub checkout into a DSH profile through DSH's official plugin command:

```bash
dsh plugin --profile web add github:cyanseek/dsh-native-playbook
```

For a local checkout, run this from the repository root:

```bash
dsh plugin --profile web add .
```

The package declares an official DSH bundle layer in `package.json` and
`cordis.patch.yml`. Once mounted, it registers one model-facing tool,
`native_capability`, inside that DSH profile. The tool calls the same resolver as the
CLI/API and marks capabilities visible to the calling Agent as `ready`; it does not
maintain a second catalog.

Git-hosted installation builds the TypeScript source through the package's `prepare`
script. pnpm 10 may first ask you to allow that build in the profile's
`pnpm-workspace.yaml`; follow the key printed by DSH/pnpm, then rerun the command.

### Install the Agent Skill for Codex

```bash
npx skills@latest add cyanseek/dsh-native-playbook \
  --skill dsh-native-playbook \
  --agent codex \
  --yes
```

Then use your coding agent normally. You do not need to mention the playbook in every
prompt.

The repository also includes the current official Codex skill-only plugin entry point at
`.codex-plugin/plugin.json`. It points to the same `skills/` tree; there is no duplicate
resolver or second capability catalog. See the official
[Codex plugin packaging guide](https://developers.openai.com/plugins/build/plugins).

### Run the CLI from a checkout

```bash
git clone https://github.com/cyanseek/dsh-native-playbook.git
cd dsh-native-playbook
corepack enable
pnpm install --frozen-lockfile
pnpm build

pnpm dsh-native lookup "run tests in background"
pnpm dsh-native lookup "find all symbol references" --json
pnpm dsh-native status --profile web
```

The npm package metadata is ready for a future registry release. Until that release
exists, this README intentionally does not claim that `npx dsh-native-playbook@latest`
works.

### Install into a DSH-scanned Skill root

Project-shared Skill:

```bash
pnpm dsh-native install --target project
```

This copies the Skill to `.agents/skills/dsh-native-playbook/`.

User DSH Skill:

```bash
pnpm dsh-native install --target dsh
```

This copies it to `$DSH_HOME/skills/dsh-native-playbook/`, or `~/.dsh/skills/` when
`DSH_HOME` is unset.

## What this adds

Official DSH catalogs are implementation-oriented sources of truth. This repository adds
a task-oriented decision layer:

- a curated `task → native capability` map;
- an exact, generated snapshot pinned to one upstream commit;
- profile-aware status inspection through `dsh --profile <name> --dump-config`;
- one resolver shared by the DSH runtime plugin, CLI, and Node API;
- a concise Agent Skill with focused references and realistic recipes.

It is not a third-party plugin marketplace, an unofficial replacement for DSH docs, or a
generic tutorial.

## Relationship to DeepSeek Harness

This repository is an out-of-tree DSH plugin distribution, not a fork or replacement
Harness. Keeping the distribution repository separate is how DSH's official
`dsh plugin --profile <name> add <package-or-git-spec>` flow installs external bundle
layers. Its runtime connection to DSH is explicit:

- the `dsh.bundle.patch` manifest activates `dsh-native-playbook/plugin` in a profile;
- the adapter registers `native_capability` through that profile's `ctx.tools` service;
- live tool visibility comes from the calling DSH Agent;
- generated facts are pinned to an exact commit of the official DSH repository.

## Native-first policy

Before installing a third-party DSH plugin or writing a workaround:

1. Check whether DSH ships a native capability.
2. Prefer the most specialized native capability that is ready.
3. Distinguish `ready`, `platform-dependent`, `opt-in`, `requires-provider`, and `disabled`.
4. Use the official activation path for conditional capabilities.
5. Consider external code only after the native path is insufficient.

Package existence alone never proves readiness.

## CLI

```text
dsh-native lookup "<task>" [--profile <name>] [--json]
dsh-native status --profile <name> [--json]
dsh-native list [--profile <name>] [--json]
dsh-native explain <capability> [--profile <name>] [--json]
dsh-native doctor [--json]
dsh-native install --target project|dsh [--json]
```

Static `lookup` works from bundled data when DSH is not installed. Profile status uses the
official config-dump command and does not boot the Web UI. JSON mode writes only JSON to
stdout, including structured errors.

Example:

```bash
pnpm dsh-native lookup "build a custom plugin for background jobs" --json
```

The result points to native shell jobs and sets `externalPluginNeeded` to `false`.

## Node API

```ts
import {
  inspectDshProfile,
  lookupNativeCapability,
} from 'dsh-native-playbook'

const profile = await inspectDshProfile({ profile: 'web' })
const result = await lookupNativeCapability(
  'run a long test in background',
  { profile },
)
```

The public API exports:

- `listNativeCapabilities`
- `lookupNativeCapability`
- `explainNativeCapability`
- `inspectDshProfile`
- `loadTaskMap`

No API function prompts.

## Upstream facts

`generated/upstream.json` is generated from the official
[`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness)
repository. It records the exact commit and source files. The curated task map remains
separate in `catalog/task-map.yml`.

```bash
pnpm sync:upstream
pnpm verify:upstream
```

Sync is explicit: ordinary installed use performs no network request and needs no GitHub
token. The project has no telemetry and no `postinstall` hook.

## Development

Requirements: Node.js 22 or 24 and pnpm 10.

```bash
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
```

CI runs the same gates on Linux, macOS, and Windows with Node 22 and 24.

## Contributing

The most valuable contributions are missing task mappings, better native fallbacks,
corrected profile classifications, and recipes that prevent unnecessary reinvention.
See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

See [SECURITY.md](./SECURITY.md). Please do not put credentials or private profile dumps
in an issue.

## License

[MIT](./LICENSE)
