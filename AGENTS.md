# Repository guidance

## Goal

Map a user's task to the most appropriate native DeepSeek Harness capability before
recommending an external plugin or custom workaround.

## Non-goals

- Do not become a third-party plugin registry.
- Do not mirror all upstream documentation.
- Do not add plugin-only resolver logic; the runtime adapter must call the shared resolver.
- Do not collect telemetry.

## Repository map

- `catalog/task-map.yml`: curated task-to-capability mappings.
- `generated/`: deterministic facts generated from one official upstream commit.
- `skills/dsh-native-playbook/`: concise Skill plus focused references.
- `.codex-plugin/plugin.json`: thin Codex skill-only plugin adapter over `skills/`.
- `cordis.patch.yml`: installable DSH bundle layer for the runtime adapter.
- `src/`: shared resolver, profile inspector, installer, CLI, API, and thin DSH adapter.
- `scripts/`: upstream sync and repository validation.
- `tests/`: behavior, profile, installer, and Skill contract tests.

## Source-of-truth hierarchy

1. Current official DeepSeek Harness source files pinned in `generated/upstream.json`.
2. Effective profile output from `dsh --profile <name> --dump-config`.
3. Curated intent and fallback policy in `catalog/task-map.yml`.
4. Human-facing explanations in the Skill and READMEs.

Package existence alone is never evidence that a capability is ready.

## Generated and curated files

- Never hand-edit `generated/upstream.json` or `generated/UPSTREAM_COMMIT`.
- Run `pnpm sync:upstream` to update generated facts.
- Never let upstream sync rewrite `catalog/task-map.yml` or hand-authored recipes.
- A task-map reference to a removed upstream tool must fail validation.

## Commands

```bash
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

Run the complete set before release. Use `pnpm sync:upstream -- --source-dir <checkout>`
when validating against a trusted local upstream checkout.

## Invariants

- CLI, API, and the DSH runtime adapter must use the same resolver.
- JSON mode stdout must remain parseable JSON only; diagnostics go to stderr.
- Public API functions never prompt.
- The Skill must not load every reference by default.
- The Codex manifest must point to the same `./skills/` tree and never duplicate resolver data.
- Never recommend an external plugin before checking the native task map.
- Never classify a capability as ready without effective profile and provider evidence.
- Installers must refuse to overwrite a destination owned by another Skill.
- No telemetry, `postinstall`, credential output, or install-time network fetch.

## Documentation

Update `README.md` and `README.zh-CN.md` together for every user-visible behavior change.
Keep commands executable and do not claim an unpublished or untested distribution path works.
Keep the main Skill short and put detailed domain guidance in the matching reference file.

## Release flow

1. Sync and verify the upstream snapshot.
2. Run every command in the test gate above on a supported Node version.
3. Review the packed file list and CLI JSON smoke output.
4. Confirm the changelog and version agree.
5. Tag and publish only through an explicitly authorized release operation.
