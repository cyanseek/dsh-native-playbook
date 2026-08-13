# Orchestration

Match the native mechanism to the state model: todo for implementation progress, goals for multi-turn objectives, workflow for fixed orchestration, and Ralph for repeated fresh-Agent rounds.

## Recipe 10 — Reusable deterministic pipeline

Task: “Run the same validate, package, and smoke sequence with explicit handoffs.”

Use `workflow` when the step graph and outputs are known. Keep non-deterministic research outside the fixed workflow or delegate it separately.

## Recipe 11 — Iterate until an objective is proven

Task: “Use fresh attempts to fix this benchmark until the verifier passes.”

Use `ralph` with a bounded objective, completion promise, and round limit. Do not use it as an unbounded retry loop or as a substitute for a deterministic workflow.

## Recipe 12 — Track a project across turns

Task: “Keep this release objective active while we work through several turns.”

Use `create_goal`, inspect with `get_goal`, and call `update_goal` only when completion or the strict blocked condition is evidenced. Use `todo_write` inside the active implementation turn.

## Recipe 13 — Compose parallel reads

Task: “Read several independent sources and combine their results efficiently.”

Use `run_code` when Code Mode is active and the bindings are safe to call concurrently. Otherwise invoke the ordinary native tools; do not claim Code Mode is ready in a native-only profile.

## Recipe 14 — Schedule recurring work

Task: “Run this check every weekday.”

Use `schedule_create` when the schedule package is mounted. Inspect with `schedule_list` and remove with `schedule_delete`; otherwise describe the official opt-in rather than inventing a daemon.
