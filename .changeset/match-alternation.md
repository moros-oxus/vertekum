---
"@vertekum/core": patch
"@vertekum/cli": patch
---

Schema `match` grows brace alternation in the glob (`colors-{light,black}.json` — standard comma convention, everywhere globs are matched) and accepts an array of patterns (a file matches when any does).
