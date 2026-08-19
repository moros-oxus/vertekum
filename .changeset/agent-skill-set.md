---
"@vertekum/cli": patch
---

`vertekum init` now scaffolds a grouped agent-skill set (`.claude/skills/vertekum/…` — a tokens skill covering the full verb, schema, and value-notation surface, plus a release-workflow skill), and `init --skill` refreshes the skills alone without touching the config; skills you have edited (stamp line removed) are never overwritten.
