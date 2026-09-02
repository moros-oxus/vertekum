---
"@vertekum/core": patch
"@vertekum/ext-token-ramp": patch
---

A group codec's carrier may hold a `$root` token — the root parses as the group's own value and the generated children appear beside it (previously such a group silently generated nothing). `ramp build` now emits every computed stop as `data.ramps` under `--json`, making `--dry-run --json` a first-class value source.
