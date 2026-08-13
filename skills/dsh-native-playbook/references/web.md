# Web

`web_search` and `web_fetch` are separate native capabilities. Search delegates retrieval to a configured provider. Fetch retrieves a model-selected URL and therefore has a different safety posture.

## Recipe 15 — Find current information

Task: “Find the latest official release notes.”

Use `web_search`, prefer the authoritative project source, and cite it. A mounted search provider can still require valid credentials.

## Recipe 16 — Retrieve a known page

Task: “Fetch this exact documentation URL.”

Use `web_fetch` only when the profile has explicitly enabled it with a provider. The shipped base keeps fetch disabled; do not describe it as ready merely because the tool package exists.
