# Contributing

Thank you for helping people use native DeepSeek Harness capabilities before rebuilding
them elsewhere.

## Good contributions

- A missing natural-language task mapped to an existing official capability.
- A more accurate fallback or availability classification.
- A realistic recipe that removes an unnecessary workaround.
- A parser fix backed by an upstream fixture and regression test.

Do not add third-party plugin listings unless they are needed to explain a verified gap after
native options have been exhausted.

## Development

Use Node.js 22 or 24 and pnpm 10.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm validate:skill
pnpm validate:plugin
pnpm verify:upstream
pnpm smoke:json
```

For an upstream refresh, run `pnpm sync:upstream`, review the generated diff, and then update
curated mappings only when the official facts require it. Never edit generated files directly.

## Pull requests

Keep changes focused. Explain the user task, the official source supporting the mapping, the
availability evidence, and the commands you ran. Update both READMEs for user-visible changes.
