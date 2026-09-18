---
"@vertekum/core": minor
"@vertekum/cli": minor
---

`vertekum watch` reruns one ordered pass on every change — generators, then check, then the export targets — so an edited `.dfn`, schema or token file lands in the consumer's output without a manual rebuild. A contributed command declares itself a generator with `generator: { reads }`, and `describe` reports which commands are generators. A failed pass keeps the last good export output; `--json` emits one event per line.
