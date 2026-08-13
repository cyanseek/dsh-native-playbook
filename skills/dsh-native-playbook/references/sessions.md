# Sessions

Session tools provide authorized reads, searches, event inspection, and lineage. Do not grep persistence databases or JSONL files directly when the native query seam is available.

## Recipe 17 — Recover an earlier decision

Task: “Find where we decided which database backend to use.”

Use `session_search` when full-text search is enabled. If content search is disabled, exact reads and lineage may still work; report the distinction.

## Recipe 18 — Explain parent and child history

Task: “Show how this child session relates to the original investigation.”

Use `session_trace` for lineage and `session_event_trace` for event-level context. Preserve workspace authorization boundaries.
