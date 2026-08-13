# Coding and search

Choose semantic navigation for symbols and textual search for strings. Avoid shell search when native `glob` or `grep` already expresses the query.

## Recipe 1 — Find every symbol reference

Task: “Find every reference to `createUser`.”

Use `lsp` references when an LSP provider is available. Fall back to `grep` for textual occurrences and say that the fallback may include comments, strings, or miss dynamic references.

## Recipe 2 — Locate and update configuration

Task: “Find every YAML file that sets `timeoutMs`, then change the intended one.”

Use `glob` to bound candidate files, `grep` to locate the key, `read` to inspect context, and `edit` for the minimal change. Do not turn the search into a fragile shell pipeline.

## Recipe 3 — Inspect a generated screenshot

Task: “Check whether this UI screenshot clips the composer.”

Use `read_image`. If the image path is missing, request the missing artifact; do not infer pixels from a textual filename.
