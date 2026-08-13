# Agents and delegation

Use `subagent` for independent work and `subagent_fork` when inherited parent history materially helps. Continuable children support later messages; fork children are intended for one-shot contextual investigation in the shipped base.

## Recipe 7 — Parallel bug investigation

Task: “Let another Agent investigate the parser bug while I keep implementing.”

Start `subagent` in the background with a bounded deliverable. Continue useful parent work, then inspect progress with `list_agents`.

## Recipe 8 — Reuse current conversation context

Task: “Have another Agent check this hypothesis using everything we already discussed.”

Use `subagent_fork`. Avoid copying a large conversation into a fresh child prompt.

## Recipe 9 — Refine or stop delegated work

Task: “Tell the child to include Windows, then stop it if that invalidates the approach.”

Use `send_message` for the refinement. Use `interrupt_agent` only when the active turn should stop; interruption is not deletion.
