# Long-running execution

DSH shell jobs own process identity, output, completion, and cancellation. Persistent terminals solve a different problem: interactive state across calls.

## Recipe 4 — Run tests in the background

Task: “Run the full test suite in the background and inspect the result later.”

Invoke `bash` with `run_in_background=true`, keep the returned job id, and use `job_output` until completion. Do not create PID files or redirect to a temporary log merely to regain control.

## Recipe 5 — Stop a stuck build

Task: “That background build is stuck; stop it.”

Use `job_list` if the id is unknown, then `job_kill`. Report the native job's terminal state rather than assuming the process stopped.

## Recipe 6 — Work with a REPL

Task: “Open a REPL, send several commands, and keep its state.”

Use `terminal_open`, `terminal_send`, and `terminal_read` when a terminal backend is active. If not, explain the provider requirement; do not emulate a persistent PTY with unrelated background shell calls.
