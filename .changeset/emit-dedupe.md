---
"@vertekum/schema-builder": patch
---

Emitted schemas share repeated subtrees: identical tails (optional-slot syntagms expand them once per branch) hoist into `$defs` as content-named `shared-*` entries. A consumer module that emitted 12 MB with 22k ref-sites — enough to overflow ajv's call stack at validation — now emits ~30 KB with identical validation behaviour.
