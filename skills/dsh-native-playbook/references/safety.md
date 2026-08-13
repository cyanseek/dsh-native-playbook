# Safety and interaction

Native execution still follows approval and sandbox policy. A listed tool is not permission to bypass the user's boundary.

## Recipe 19 — Resolve a user-owned choice

Task: “Choose which account or deployment target I own.”

Inspect discoverable facts first. If the decision belongs to the user or required information is not discoverable, use `ask_user_question` with concise, mutually exclusive choices.

## Recipe 20 — Finish planning safely

Task: “Present the implementation plan for approval.”

In Plan Mode, explore with read/search/LSP and submit the complete plan through `exit_plan_mode`. Do not mutate the repository before the transition succeeds.

For shell and file mutations, respect the active permission preset, workspace boundary, and approval response. Never treat a native capability as a reason to weaken those controls.
