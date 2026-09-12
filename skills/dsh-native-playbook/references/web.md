# Web

`web_search` and `web_fetch` are separate native capabilities. Search delegates retrieval to a configured provider. Fetch retrieves a model-selected URL and therefore has a different safety posture.

## Recipe 15 — Find current information

Task: “Find the latest official release notes.”

Use `web_search`, prefer the authoritative project source, and cite it. A mounted search provider can still require valid credentials.

## Recipe 16 — Retrieve a known page

Task: “Fetch this exact documentation URL.”

The pinned September 2026 base enables `web_fetch` with the anonymous HTTP provider. Earlier bases disabled it, and product profiles can still override it. Inspect the effective profile: fetch must be enabled, the web router must select `http`, and the HTTP fetch provider must be mounted and enabled. A different provider requires separate readiness evidence. Catalog defaults alone do not establish operational availability in the current session.
