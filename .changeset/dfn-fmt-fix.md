---
"@vertekum/schema-builder": patch
---

Adds `vertekum schema fmt` — canonical `.dfn` formatting with JS-literal block indentation (indent resolves from `format.indent`, then `.editorconfig`), `--check` as the CI gate — and `schema lint --fix`, which relocates a misplaced trailing `*` into the reference or group it opens. The grammar itself gains block statements: a statement ends at the first newline at bracket depth 0, so a multi-line `[ … ]` may close at any indentation, and an unclosed `[` reports its opening position.
