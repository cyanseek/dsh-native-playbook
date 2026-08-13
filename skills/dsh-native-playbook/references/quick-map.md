# Quick task map

Use this index to route by the user's intended outcome. Availability is profile-specific; the table deliberately does not label capabilities as globally ready.

| User intent | Prefer | Fallback or condition |
|---|---|---|
| Read text | `read` | Use bounded ranges for large files |
| Inspect an image | `read_image` | Requires an authorized local image path |
| Create or replace a file | `write` | Preserve unrelated user changes |
| Apply a precise edit | `edit` | Re-read when observed content changed |
| Structured string replacement | `str_replace_editor` | Use its view operation before mutation |
| Find files | `glob` | Narrow the pattern before shell discovery |
| Search text | `grep` | Prefer repository-aware search |
| Navigate definitions or references | `lsp` | `grep` when no language server is available |
| Run a Unix-like command | `bash` | `pwsh` on Windows |
| Run a Windows command | `pwsh` | `bash` on Unix-like platforms |
| Start a long command | `bash(run_in_background=true)` | Then use native jobs |
| List background work | `job_list` | — |
| Read background output | `job_output` | Poll the same job id |
| Stop background work | `job_kill` | — |
| Keep interactive terminal state | `terminal_open` + `terminal_read` | Needs a terminal provider |
| Load domain guidance | `skill` | Load only the relevant Skill |
| Delegate independent research | `subagent` | Keep useful parent work moving |
| Reuse parent conversation history | `subagent_fork` | Prefer for one-shot contextual work |
| Inspect child Agents | `list_agents` | — |
| Follow up with a child | `send_message` | Child must be continuable |
| Interrupt a child | `interrupt_agent` | Does not delete child identity |
| Run fixed multi-step orchestration | `workflow` | Keep the workflow deterministic |
| Iterate with fresh Agents | `ralph` | Use a bounded objective and completion promise |
| Track implementation work | `todo_write` | Not for Plan Mode drafting |
| Persist a multi-turn objective | goal tools | Complete only from evidence |
| Search current internet information | `web_search` | Provider credentials may still matter |
| Retrieve an exact URL | `web_fetch` | Shipped base disables fetch by default |
| Ask for a user-owned choice | `ask_user_question` | First inspect discoverable facts |
| Submit a plan for approval | `exit_plan_mode` | Only while Plan Mode is active |
| Search durable history | session query tools | Content search can be opt-in |
| Compose typed tool calls | `run_code` | Requires Code Mode or both mode |
| Create recurring work | schedule tools | Requires the schedule package |

If the task says “build a plugin” but the requested behavior maps above, explain and use the native path first.
