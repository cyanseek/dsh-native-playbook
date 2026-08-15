# Sessions

Session tools provide authorized reads, searches, event inspection, and lineage. Do not grep persistence databases or JSONL files directly when the native query seam is available.

## Recipe 17 — Recover an earlier decision

Task: “Find where we decided which database backend to use.”

Use `session_search` when full-text search is enabled. When it is opt-in, allow the installed
`native_capability` tool to apply the reviewed official activation on a compatible DSH
version. If the result says `restart`, explain that the configuration is verified but the
current DSH process must restart before the search tool becomes visible. Do not ask the user
to inspect profile files or run a separate verification command.

## Recipe 18 — Explain parent and child history

Task: “Show how this child session relates to the original investigation.”

Use `session_trace` for lineage and `session_event_trace` for event-level context. Preserve workspace authorization boundaries.
