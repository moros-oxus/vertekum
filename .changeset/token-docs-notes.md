---
"@vertekum/core": minor
"@vertekum/ext-token-docs": minor
---

Tokens and groups can carry notes for documentation, agents and MCP: `@vertekum/ext-token-docs` stores one note per configured category under `org.vertekum.docs`, written while a token is created or changed (`token add … --comment "…"`) or through `docs set|show|remove`. Core now preserves every `$extensions` key verbatim — the old allow-list silently dropped unrecognised `org.vertekum.*` keys whenever a node was rewritten — and a command-chain link can read the invocation's options and attach `$extensions` data through `ValueProposal.extensions`.
