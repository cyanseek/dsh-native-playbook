# Security policy

## Supported versions

Security fixes are applied to the latest released minor version.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository. If that channel is unavailable,
open a minimal issue asking the maintainer to enable a private contact path; do not disclose the
vulnerability or proof of concept publicly.

Never include API keys, tokens, private profile dumps, environment files, session data, or local
filesystem details in a report. Use synthetic examples.

## Security posture

- No telemetry.
- No `postinstall` hook.
- No runtime network access for ordinary lookup or installation.
- Upstream sync is an explicit development command and pins one commit.
- Profile inspection executes `dsh --dump-config` directly without a shell and never boots Web.
- The Skill installer refuses to overwrite a destination owned by another Skill.
