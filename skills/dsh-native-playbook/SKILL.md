---
name: dsh-native-playbook
description: >
  Use DeepSeek Harness's built-in tools and capabilities before installing
  third-party plugins or inventing shell/custom workarounds. Use whenever a
  task may be handled by native DSH files, search, shell, jobs, LSP, subagents,
  workflow, Ralph, goals, todo, web, sessions, planning, or other shipped
  capabilities; also use when deciding whether a new DSH plugin is necessary.
---

# DeepSeek Harness Native Playbook

Use DSH's native capabilities before adding another plugin or building a workaround.

## Workflow

1. Classify the user's task by intent, not by package name.
2. Read `references/quick-map.md`.
3. Load only the focused reference needed for the task.
4. Prefer a native capability already available in the current tool set.
5. Prefer specialized native infrastructure over shell workarounds.
6. If a capability is shipped but opt-in, disabled, platform-dependent, or provider-dependent, state that accurately.
7. Only look for an external Skill, plugin, or custom implementation after native options are exhausted.
8. Do not ask the user to choose among internal DSH packages when the task determines the answer.

## Focused references

- File work, search, editing, and LSP: `references/coding.md`
- Shell, background jobs, and terminals: `references/long-running.md`
- Subagents and child control: `references/agents.md`
- Workflows, Ralph, todo, goals, schedules, and Code Mode: `references/orchestration.md`
- Web search and fetch: `references/web.md`
- Historical session lookup and lineage: `references/sessions.md`
- Approval, sandbox, questions, and Plan Mode: `references/safety.md`
- Activation and status language: `references/opt-in.md`

## Decision rule

```text
task
  → native capability ready? use it
  → shipped but conditional? explain or activate the official path
  → no adequate native path? consider an existing Skill or external plugin
  → still no fit? build the smallest custom implementation
```

Do not infer readiness from package existence alone. When exact profile state matters, use
`dsh-native status --profile <name>` or inspect the current DSH tool set.
